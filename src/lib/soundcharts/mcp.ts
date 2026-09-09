/**
 * Cliente do MCP da Soundcharts — SÓ SERVIDOR (usa o client secret).
 *
 * Autentica por OAuth `client_credentials`, que é máquina a máquina: nenhum
 * navegador, nenhum usuário logado. É o que permite a consulta acontecer no
 * clique do botão de diagnóstico, como a Imagine pediu, em vez de um sync
 * noturno. Ver `scripts/check-soundcharts-mcp.mjs` para o diagnóstico manual.
 *
 * Cota: 10 mil requisições/mês do time inteiro (compartilhada com o uso que a
 * própria equipe faz no site da Soundcharts). Cada consulta de artista gasta
 * ~4, então o teto só apertaria com milhares de diagnósticos por mês.
 */
const TOKEN_URL = 'https://account.soundcharts.com/oauth/token'
const MCP_URL = 'https://mcp.soundcharts.com/mcp'
const PROTOCOLO = '2025-06-18'

export class SoundchartsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SoundchartsConfigError'
  }
}

export class SoundchartsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SoundchartsError'
  }
}

export function soundchartsConfigurado(): boolean {
  return Boolean(process.env.SOUNDCHARTS_CLIENT_ID && process.env.SOUNDCHARTS_CLIENT_SECRET)
}

/* ── token ─────────────────────────────────────────────────────────────────── */

let tokenCache: { valor: string; expiraEm: number } | null = null

/**
 * O token vale 365 dias, então cachear em memória do processo evita uma ida ao
 * OAuth por requisição. A margem de 5 minutos existe para o caso raro de um
 * token curto: melhor renovar cedo do que servir um expirado.
 */
async function obterToken(): Promise<string> {
  const agora = Date.now()
  if (tokenCache && tokenCache.expiraEm > agora + 300_000) return tokenCache.valor

  const id = process.env.SOUNDCHARTS_CLIENT_ID
  const secret = process.env.SOUNDCHARTS_CLIENT_SECRET
  if (!id || !secret) {
    throw new SoundchartsConfigError(
      'Soundcharts não configurado (defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET).',
    )
  }

  const corpo = new URLSearchParams({ grant_type: 'client_credentials' })
  const time = process.env.SOUNDCHARTS_TEAM
  // Sem `team_id` o token sai válido mas SEM os acessos do plano do time.
  if (time) corpo.set('team_id', time)

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: corpo,
    cache: 'no-store',
  })
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!r.ok || !j.access_token) {
    throw new SoundchartsError(
      `Soundcharts recusou as credenciais (${r.status}): ${j.error ?? ''} ${j.error_description ?? ''}`.trim(),
    )
  }
  tokenCache = { valor: j.access_token, expiraEm: agora + (j.expires_in ?? 3600) * 1000 }
  return tokenCache.valor
}

/* ── sessão MCP ────────────────────────────────────────────────────────────── */

/** O transporte Streamable HTTP responde JSON puro OU SSE — os dois viram objeto. */
async function corpoDe(r: Response): Promise<unknown> {
  const texto = await r.text()
  if (!texto.trim()) return null
  if ((r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const dados = texto
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
    return dados.length ? JSON.parse(dados[dados.length - 1]) : null
  }
  return JSON.parse(texto)
}

interface RespostaJsonRpc {
  result?: { content?: { text?: string }[]; [k: string]: unknown }
  error?: { message?: string; code?: number }
}

/**
 * Uma sessão MCP por consulta. Não vale a pena reaproveitar entre requisições:
 * o handshake custa duas chamadas e o serverless recicla o processo a qualquer
 * momento — uma sessão morta seria erro difícil de ler.
 */
export class SessaoSoundcharts {
  private sessao: string | null = null
  private proximoId = 1
  private token: string | null = null

  private async requisitar(metodo: string, params: unknown, comId: boolean): Promise<unknown> {
    this.token ??= await obterToken()
    const cabecalhos: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
      'MCP-Protocol-Version': PROTOCOLO,
    }
    if (this.sessao) cabecalhos['Mcp-Session-Id'] = this.sessao

    const corpo = comId
      ? { jsonrpc: '2.0', id: this.proximoId++, method: metodo, params }
      : { jsonrpc: '2.0', method: metodo, params }

    const r = await fetch(MCP_URL, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(corpo),
      cache: 'no-store',
    })
    const nova = r.headers.get('mcp-session-id')
    if (nova) this.sessao = nova

    if (r.status === 401) {
      // Token revogado ou expirado: uma renovação e uma retentativa, sem laço.
      tokenCache = null
      this.token = null
      throw new SoundchartsError('Soundcharts recusou o token (401).')
    }
    if (!r.ok) {
      throw new SoundchartsError(`Soundcharts respondeu ${r.status} em ${metodo}.`)
    }
    return corpoDe(r)
  }

  async abrir(): Promise<void> {
    await this.requisitar(
      'initialize',
      {
        protocolVersion: PROTOCOLO,
        capabilities: {},
        clientInfo: { name: 'painel-imagine', version: '1.0.0' },
      },
      true,
    )
    await this.requisitar('notifications/initialized', {}, false)
  }

  /**
   * Chama uma ferramenta e devolve o JSON que ela embrulha em `content[].text`.
   *
   * Devolve `null` em vez de estourar quando a ferramenta responde erro de
   * ENTIDADE (404): "esse artista não tem conta nessa plataforma" é resposta
   * legítima, não falha — o YouTube, por exemplo, responde 404 para artista sem
   * canal vinculado. Erro de transporte continua estourando.
   */
  async ferramenta<T>(nome: string, args: Record<string, unknown>): Promise<T | null> {
    const j = (await this.requisitar('tools/call', { name: nome, arguments: args }, true)) as
      | RespostaJsonRpc
      | null
    if (j?.error) return null
    const texto = (j?.result?.content ?? []).map((c) => c.text ?? '').join('\n')
    if (!texto.trim()) return null
    try {
      const dado = JSON.parse(texto) as T & { error?: unknown }
      return dado?.error ? null : dado
    } catch {
      return null
    }
  }
}

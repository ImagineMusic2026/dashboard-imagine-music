import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { getMetaConfig, MetaConfigError, metaConfigurado } from '@/lib/meta/config'
import { MetaApiException } from '@/lib/meta/client'
import { casarContasComArtistas, listarContasIG } from '@/lib/meta/accounts'
import {
  gravarStatusMeta,
  listarArtistasInstagram,
  salvarVinculoInstagram,
} from '@/lib/metricas-sociais/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Descoberta de contas: lista as contas IG acessíveis pelo token, casa cada uma
 * com um artista pelo @handle e grava o IG User ID em
 * `artistas/{slug}.redes.instagram.id`. Devolve um relatório do que casou e do
 * que ficou pendente (para a UI orientar o vínculo). Só admin.
 */
export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'integracoes')
  if (auth instanceof NextResponse) return auth

  if (!metaConfigurado()) {
    return NextResponse.json(
      {
        error:
          'Integração Meta não configurada. Defina META_APP_ID, META_APP_SECRET e META_SYSTEM_USER_TOKEN no ambiente.',
      },
      { status: 503 },
    )
  }

  try {
    const [contas, artistas] = await Promise.all([
      listarContasIG(),
      listarArtistasInstagram(),
    ])

    const resultado = casarContasComArtistas(
      contas,
      artistas.map((a) => ({ slug: a.slug, handle: a.handle })),
    )

    // Persiste o IG User ID nos artistas que casaram.
    await Promise.all(resultado.casados.map((c) => salvarVinculoInstagram(c.slug, c.conta.id)))

    await gravarStatusMeta({
      status: 'conectado',
      contasMapeadas: resultado.casados.length,
      totalArtistas: artistas.length,
      ultimaDescoberta: new Date().toISOString(),
      erro: null,
      graphVersion: getMetaConfig().graphVersion,
    })

    return NextResponse.json({
      ok: true,
      contasDescobertas: contas.length,
      totalArtistas: artistas.length,
      mapeados: resultado.casados.length,
      casados: resultado.casados.map((c) => ({ slug: c.slug, username: c.conta.username })),
      semConta: resultado.semConta,
      contasNaoUsadas: resultado.contasNaoUsadas.map((c) => c.username),
    })
  } catch (e) {
    const msg =
      e instanceof MetaApiException || e instanceof MetaConfigError
        ? e.message
        : 'Falha ao descobrir contas no Meta.'
    console.error('[api/integracoes/meta/descobrir]', e)
    await gravarStatusMeta({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

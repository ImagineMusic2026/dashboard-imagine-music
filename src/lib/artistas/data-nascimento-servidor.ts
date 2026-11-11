import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { lerDataNascimento, type OrigemDataNascimento } from '@/lib/artistas/aniversario'

/**
 * A data de nascimento que o artista respondeu no questionário indo para o cadastro
 * (`artistas/{slug}`), onde o alerta de aniversário a lê. ⚠️ Só servidor — Admin SDK.
 *
 * Um módulo, e não um trecho em cada rota, porque o questionário é enviado por DOIS
 * caminhos e os dois têm de seguir a mesma política: o link público
 * (`/api/questionario-link`, sem login) e o envio pelo portal ou pelo painel
 * (`/api/diagnostico/data-nascimento`). Passa pelo servidor porque `artistas/{slug}`
 * nega escrita pelo navegador — e o artista nem tem permissão de mexer no cadastro.
 *
 * ── Política ───────────────────────────────────────────────────────────────
 *
 * - Resposta vazia ou inválida não faz nada. NUNCA apaga: limpar a resposta do
 *   questionário não é dizer que o cadastro deve ficar sem data.
 * - Cadastro sem data: grava.
 * - Data que o próprio questionário gravou antes: atualiza — o artista corrigiu.
 * - Data que a equipe digitou no cadastro (ou data sem origem, que é de antes do
 *   questionário e só a equipe gravava): MANTÉM. A equipe manda; se o artista
 *   respondeu outra coisa, ela vê no questionário e decide.
 * - Data que a equipe APAGOU (origem 'equipe' sem data): também mantém — vazio.
 *   Apagar foi decisão dela; o questionário não pode desfazer em silêncio.
 *
 * Data ilegível no cadastro conta como ausente: nenhum leitor (alerta, perfil) a
 * enxerga, e mantê-la só deixaria o artista sem alerta de aniversário. As telas e
 * rotas do painel já validam com `lerDataNascimento` antes de gravar, então isso só
 * pega o que foi digitado à mão no Console.
 */

/** O que a cópia fez. Serve a log e teste — o link público não repassa isso a ninguém. */
export type ResultadoCopiaDataNascimento = 'gravada' | 'mantida' | 'ignorada'

const ORIGEM: OrigemDataNascimento = 'questionario'

export async function copiarDataNascimentoDoQuestionario(
  slug: string,
  resposta: unknown,
): Promise<ResultadoCopiaDataNascimento> {
  // A MESMA validação do formulário, do cadastro e do alerta: o que passasse aqui e
  // fosse recusado lá ficaria gravado sem nunca avisar aniversário nenhum.
  const nova = lerDataNascimento(resposta)
  if (!nova || typeof resposta !== 'string') return 'ignorada'
  const valor = resposta.trim()
  // Slug com barra viraria outro caminho do Firestore. Quem chama já confere, mas é
  // escrita sem dono no link público — não custa recusar aqui também.
  if (!slug || slug.includes('/')) return 'ignorada'

  const ref = adminDb.doc(`artistas/${slug}`)
  return adminDb.runTransaction<ResultadoCopiaDataNascimento>(async (tx) => {
    const snap = await tx.get(ref)
    // Sem cadastro, sem cópia. `set` com merge CRIARIA o doc, e um artista sem nome
    // nem redes apareceria no roster por causa de um questionário. Por isso a leitura
    // na transação e o `update`, que nunca cria.
    if (!snap.exists) return 'ignorada'
    const x = snap.data() ?? {}
    if (x.dataNascimentoOrigem === 'equipe') return 'mantida'
    const atual = lerDataNascimento(x.dataNascimento)
    if (atual) {
      if (x.dataNascimentoOrigem !== 'questionario') return 'mantida'
      // A mesma data de novo (reenvio do questionário): não regrava. O carimbo diz
      // quando a data MUDOU, não quando o artista apertou "Enviar" de novo.
      if (atual.ano === nova.ano && atual.mes === nova.mes && atual.dia === nova.dia) return 'mantida'
    }
    tx.update(ref, {
      dataNascimento: valor,
      dataNascimentoOrigem: ORIGEM,
      dataNascimentoAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 'gravada'
  })
}

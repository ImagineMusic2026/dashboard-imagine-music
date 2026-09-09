/**
 * Cadastra no roster os artistas das CONTAS IRMÃS da Imagine na OneRPM.
 *
 *   node scripts/registrar-artistas-contas-irmas.mjs [--dry]
 *
 * Contexto: até 09/09/2026 o painel só cobria os artistas da conta principal
 * (Imagine Music). Com o catálogo das três contas importado, apareceram 314
 * faixas de gente que não estava no roster — e a Imagine confirmou que os das
 * contas irmãs são dela.
 *
 * O critério de quem entra é a CONTA, não a contagem de faixas: quem assina
 * álbum em `hub_digital` ou `irmao_lazaro` é artista da casa. Quem aparece só na
 * conta principal e não está no roster foi deixado de FORA de propósito — ali
 * moram os convidados de peso (Maiara & Maraisa, Zé Neto & Cristiano, Tierry,
 * Felipe Araújo), que assinam o álbum porque a faixa é dividida, não porque são
 * do casting. Criar esses seria poluir o roster com artista de fora.
 *
 * Idempotente: quem já existe é pulado, nada é sobrescrito. Depois de rodar,
 * rode `scripts/atribuir-fonogramas.mjs` para as faixas encontrarem o dono.
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const dry = process.argv.includes('--dry')

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()
const agora = admin.firestore.FieldValue.serverTimestamp()

/** Levantado do catálogo em 09/09/2026; o número é de álbuns assinados. */
const NOVOS = [
  { slug: 'irmao-lazaro', nome: 'Irmão Lázaro', conta: 'irmao_lazaro', albuns: 161 },
  { slug: 'anderson-silva', nome: 'Anderson Silva', conta: 'hub_digital', albuns: 113 },
  { slug: 'dd-pires', nome: 'DD Pires', conta: 'hub_digital', albuns: 26 },
  { slug: 'vicente-oliveira', nome: 'Vicente Oliveira', conta: 'hub_digital', albuns: 16 },
  { slug: 'victor-vinny', nome: 'Victor Vinny', conta: 'hub_digital', albuns: 12 },
  { slug: 'taciane-vaqueira', nome: 'Taciane Vaqueira', conta: 'hub_digital', albuns: 10 },
  { slug: 'gean-lima', nome: 'Gean Lima', conta: 'hub_digital', albuns: 5 },
  { slug: 'vitorinha', nome: 'Vitorinha', conta: 'hub_digital', albuns: 4 },
  { slug: 'bahia-hits', nome: 'Bahia Hits', conta: 'hub_digital', albuns: 2 },
  { slug: 'naldinho', nome: 'Naldinho', conta: 'hub_digital', albuns: 1 },
  { slug: 'dona-ana', nome: 'Dona Ana', conta: 'hub_digital', albuns: 1 },
  { slug: 'xand-hits', nome: 'Xand Hits', conta: 'hub_digital', albuns: 1 },
]

let criados = 0
let pulados = 0
for (const a of NOVOS) {
  const ref = db.collection('artistas').doc(a.slug)
  if ((await ref.get()).exists) {
    console.log(`  já existe, pulando: ${a.slug}`)
    pulados++
    continue
  }
  if (!dry) {
    await ref.set(
      {
        nome: a.nome,
        slug: a.slug,
        // Marca de onde veio, para diferenciar de quem foi cadastrado à mão.
        fonteCadastro: `onerpm-catalogo:${a.conta}`,
        criadoEm: agora,
        cadastroAtualizadoEm: agora,
        criadoPorEmail: 'onerpm-catalogo',
        cadastroPorEmail: 'onerpm-catalogo',
        // Sem redes sociais: o cadastro entra pelo catálogo e a equipe completa
        // depois. Sem isso o artista aparece no roster sem métrica nenhuma, o
        // que é a leitura correta — ninguém mediu ainda.
        pendenteConfiguracao: true,
        pendenteDesde: Date.now(),
      },
      { merge: true },
    )
  }
  console.log(`  ${dry ? 'criaria' : 'cadastrado'}: ${a.nome} (${a.slug}) · ${a.albuns} álbuns · ${a.conta}`)
  criados++
}

console.log(`\n${dry ? 'a criar' : 'criados'}: ${criados} | já existiam: ${pulados}`)
if (!dry && criados) {
  console.log('\n⚠ Agora rode a atribuição para as faixas acharem o dono:')
  console.log('    node scripts/atribuir-fonogramas.mjs --dry')
  console.log('    node scripts/atribuir-fonogramas.mjs')
}
process.exit(0)

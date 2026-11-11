'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import {
  atualizarAlertasVistos,
  carregarAlertasCompleto,
  lerAlertasVistos,
  type AlertasCarregados,
} from '@/lib/alertas/client'
import { comVistos, manterVistos, semMarcas, type MapaVistos } from '@/lib/alertas/vistos'
import { aoInvalidar } from '@/lib/cache-leitura'
import { ehStaff } from '@/lib/permissions'

/** Aba que volta ao primeiro plano depois disto (ex.: deixada aberta de um dia pro outro) relê sozinha. */
const VELHA_PARA_ABA = 60 * 60_000
/**
 * Os vistos também são relidos ao voltar à aba, se a última leitura tiver mais que
 * isto: marcar em outra aba, ou no celular, tem de valer aqui. É um documento só.
 */
const VISTOS_VELHOS = 5 * 60_000

type Transformacao = (atual: MapaVistos) => MapaVistos | null

type ContextoAlertas = {
  /** A lista completa (antes de preferências e vistos). `null` enquanto carrega ou sem acesso. */
  carregados: AlertasCarregados | null
  /** A lista não carregou (permissão, cota, rede). */
  falhou: boolean
  /** Uma releitura da lista está em andamento. */
  carregando: boolean
  /** Os alertas que ESTA pessoa marcou como vistos. `null` enquanto não carregou. */
  vistos: MapaVistos | null
  /** Marca (otimista). Resolve `false` se não gravou — a marca já terá voltado. */
  marcar: (chaves: string[]) => Promise<boolean>
  /** Tira as marcas (todas as que escondem o alerta — ver `chavesQueCobrem`). */
  desmarcar: (chaves: string[]) => Promise<boolean>
  /**
   * Relê a lista se ela estiver suja (alguém gravou algo no painel), se a última
   * carga falhou, ou se tiver mais de `idadeMaxMs`. Quem chama: as telas que
   * MOSTRAM alertas, ao abrir.
   */
  renovar: (idadeMaxMs?: number) => void
}

const Contexto = createContext<ContextoAlertas>({
  carregados: null,
  falhou: false,
  carregando: false,
  vistos: null,
  marcar: async () => false,
  desmarcar: async () => false,
  renovar: () => {},
})

/**
 * A lista de alertas e os vistos da pessoa, num lugar só, no casco do painel.
 *
 * Sino, badge do menu, Home e página de Alertas leem o MESMO array daqui. Antes cada
 * um carregava o seu: o sino uma vez por aba aberta, as páginas a cada visita — e
 * bastava editar um artista para a página e o sino contarem coisas diferentes, ou
 * "Marcar todos como vistos" zerar a página e deixar o sino em 1.
 *
 * A lista é relida só quando faz sentido, e nunca a cada visita: o banco roda no
 * plano gratuito, e a derivação inclui a consulta de todos os questionários.
 * - Ao montar o casco (abrir ou recarregar a aba).
 * - Ao abrir uma tela que mostra alertas, se a lista estiver SUJA: alguém gravou
 *   algo pelo painel e invalidou os caches. Invalidar só suja — não relê na hora.
 *   Salvar o dossiê invalida uma vez por bloco, até cinco seguidas, e reler a cada
 *   uma pagava cinco vezes a lista inteira para descartar quatro.
 * - Ao abrir a página de Alertas com a lista de mais de alguns minutos.
 * - Ao voltar a uma aba esquecida por mais de uma hora (ou suja).
 *
 * Os vistos: lidos UMA vez por sessão. Cada mudança é otimista e entra numa fila —
 * as transações rodam uma de cada vez, e a tela mostra as pendentes aplicadas sobre
 * o último estado confirmado pelo servidor. Assim duas marcações seguidas, uma delas
 * falhando, não deixam a tela mentindo sobre o que ficou gravado.
 */
export function AlertasProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth()
  const uid = user?.uid ?? null
  const equipe = ehStaff(role)

  const [carregados, setCarregados] = useState<AlertasCarregados | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const carregadoEm = useRef(0)
  const sujo = useRef(false)
  // Cada carga leva um número; só a mais nova pode escrever o resultado.
  const geracao = useRef(0)

  const [vistos, setVistos] = useState<MapaVistos | null>(null)
  const confirmado = useRef<MapaVistos | null>(null)
  const pendentes = useRef<Transformacao[]>([])
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  // Sobe a cada transação concluída: uma releitura dos vistos que saiu ANTES dela é
  // mais velha que o `confirmado` e não pode pisar nele.
  const versaoVistos = useRef(0)
  const vistosLidosEm = useRef(0)

  const carregar = useCallback(() => {
    const minha = ++geracao.current
    sujo.current = false
    setCarregando(true)
    carregarAlertasCompleto()
      .then((r) => {
        if (minha !== geracao.current) return
        carregadoEm.current = Date.now()
        setCarregados(r)
        setFalhou(false)
      })
      .catch(() => {
        if (minha !== geracao.current) return
        setFalhou(true)
      })
      .finally(() => {
        if (minha === geracao.current) setCarregando(false)
      })
  }, [])

  const recalcular = useCallback(() => {
    if (confirmado.current === null) return
    setVistos(pendentes.current.reduce((m, t) => t(m) ?? m, confirmado.current))
  }, [])

  // Troca de pessoa (ou de papel) zera tudo: a fila velha não pode gravar no doc novo.
  useEffect(() => {
    geracao.current++
    setCarregados(null)
    setFalhou(false)
    setCarregando(false)
    carregadoEm.current = 0
    sujo.current = false
    confirmado.current = null
    pendentes.current = []
    fila.current = Promise.resolve()
    setVistos(null)
    if (!uid || !equipe) return

    carregar()

    let vivo = true
    const lerVistos = () => {
      const versao = versaoVistos.current
      vistosLidosEm.current = Date.now()
      lerAlertasVistos(uid)
        .then((m) => {
          // Uma transação concluída depois que esta leitura saiu já trouxe um estado
          // mais novo — não pisar nele.
          if (!vivo || versaoVistos.current !== versao) return
          confirmado.current = m
          recalcular()
        })
        .catch(() => {
          // Sem conseguir ler (rede, ou regra ainda não publicada), o painel segue
          // como antes do recurso existir: nada aparece como visto. Numa releitura,
          // mantém o que já tinha.
          if (!vivo || versaoVistos.current !== versao || confirmado.current !== null) return
          confirmado.current = {}
          recalcular()
        })
    }
    lerVistos()

    const pararDeOuvir = aoInvalidar(() => {
      sujo.current = true
    })
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
      if (sujo.current || Date.now() - carregadoEm.current > VELHA_PARA_ABA) carregar()
      if (Date.now() - vistosLidosEm.current > VISTOS_VELHOS) lerVistos()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      pararDeOuvir()
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [uid, equipe, carregar, recalcular])

  const aplicar = useCallback(
    (transformar: Transformacao): Promise<boolean> => {
      if (!uid) return Promise.resolve(false)
      const base = pendentes.current.reduce((m, t) => t(m) ?? m, confirmado.current ?? {})
      if (!transformar(base)) return Promise.resolve(true)
      pendentes.current = [...pendentes.current, transformar]
      recalcular()
      const vez = fila.current.then(async () => {
        try {
          confirmado.current = await atualizarAlertasVistos(uid, transformar)
          versaoVistos.current++
          return true
        } catch {
          return false
        } finally {
          pendentes.current = pendentes.current.filter((t) => t !== transformar)
          recalcular()
        }
      })
      fila.current = vez
      return vez
    },
    [uid, recalcular],
  )

  const marcar = useCallback((chaves: string[]) => aplicar((atual) => comVistos(atual, chaves)), [aplicar])

  const desmarcar = useCallback((chaves: string[]) => aplicar((atual) => semMarcas(atual, chaves)), [aplicar])

  // A faxina: toda lista COMPLETA nova, depois que os vistos chegaram. Uma fonte que
  // não respondeu tiraria os alertas dela da lista, e a faxina apagaria as marcas deles.
  const vistosProntos = vistos !== null
  useEffect(() => {
    if (carregados?.completo && vistosProntos) {
      const lista = carregados.alertas
      void aplicar((atual) => manterVistos(atual, lista))
    }
  }, [carregados, vistosProntos, aplicar])

  const renovar = useCallback(
    (idadeMaxMs?: number) => {
      if (!uid || !equipe) return
      const velha = idadeMaxMs !== undefined && carregadoEm.current > 0 && Date.now() - carregadoEm.current > idadeMaxMs
      if (falhou || sujo.current || velha) carregar()
    },
    [uid, equipe, falhou, carregar],
  )

  return (
    <Contexto.Provider value={{ carregados, falhou, carregando, vistos, marcar, desmarcar, renovar }}>
      {children}
    </Contexto.Provider>
  )
}

export function useAlertas() {
  return useContext(Contexto)
}

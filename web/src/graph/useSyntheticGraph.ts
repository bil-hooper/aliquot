import { useEffect, useState } from 'react'
import type { SyntheticGraph } from './types'

export type GraphLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: SyntheticGraph }

// Fetches the pre-baked skeleton JSON from /public. Swapping this URL for a
// real build-time export later is the only change the renderer needs -- the
// scene components below consume SyntheticGraph, not anything generator-specific.
export function useSyntheticGraph(url: string): GraphLoadState {
  const [state, setState] = useState<GraphLoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<SyntheticGraph>
      })
      .then((graph) => {
        if (!cancelled) setState({ status: 'ready', graph })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setState({
          status: 'error',
          message: `${message} -- run "node scripts/generate-synthetic-graph.mjs" from the repo root first.`,
        })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return state
}

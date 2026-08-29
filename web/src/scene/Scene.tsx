import { OrbitControls } from '@react-three/drei'
import { useMemo } from 'react'
import type { GraphNode, SyntheticGraph } from '../graph/types'
import { EdgeLines } from './EdgeLines'
import { FpsMeter } from './FpsMeter'
import { ShellInstances } from './ShellInstances'

interface SceneProps {
  graph: SyntheticGraph
  showEdges: boolean
  showOuterShell: boolean
  onFpsSample: (fps: number) => void
}

// Outward per plan sec 2.3's ordering: core, members, covering bands and
// their two sub-orbits, original artists and their two sub-orbits, then the
// faint outer personnel shell.
const SHELL_ORDER = ['0', '1', '2', '2a', '2b', '3', '3a', '3b', '4']

export function Scene({ graph, showEdges, showOuterShell, onFpsSample }: SceneProps) {
  const nodesByShell = useMemo(() => {
    const map = new Map<string, GraphNode[]>()
    for (const node of graph.nodes) {
      const bucket = map.get(node.shell)
      if (bucket) bucket.push(node)
      else map.set(node.shell, [node])
    }
    return map
  }, [graph.nodes])

  return (
    <>
      <FpsMeter onSample={onFpsSample} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={400} />
      <EdgeLines nodes={graph.nodes} edges={graph.edges} visible={showEdges} />
      {SHELL_ORDER.map((shell) => {
        if (shell === '4' && !showOuterShell) return null
        return <ShellInstances key={shell} shell={shell} nodes={nodesByShell.get(shell) ?? []} />
      })}
    </>
  )
}

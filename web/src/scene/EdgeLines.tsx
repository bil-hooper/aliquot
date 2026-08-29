import { useMemo } from 'react'
import * as THREE from 'three'
import type { GraphEdge, GraphNode } from '../graph/types'
import { DEFAULT_EDGE_COLOR, EDGE_COLOR } from '../graph/shellStyle'

interface EdgeLinesProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  visible: boolean
}

// A single LineSegments buffer for every edge in the graph, vertex-colored by
// edge type -- plan sec 3.2: "Single LineSegments buffer for all edges, with
// vertex colors. Update opacity via a color attribute, not by rebuilding
// geometry." (This spike doesn't yet do focus-based opacity -- that's the
// GPU-picking/hover work the plan schedules separately -- but the buffer
// shape here is exactly what that update would mutate in place.)
export function EdgeLines({ nodes, edges, visible }: EdgeLinesProps) {
  const geometry = useMemo(() => {
    const positionById = new Map(nodes.map((n) => [n.id, n.position]))
    const positions = new Float32Array(edges.length * 6)
    const colors = new Float32Array(edges.length * 6)
    const color = new THREE.Color()
    let cursor = 0
    for (const edge of edges) {
      const from = positionById.get(edge.source)
      const to = positionById.get(edge.target)
      if (!from || !to) continue // shouldn't happen -- the generator guarantees no dangling refs
      const base = cursor * 6
      positions[base] = from[0]
      positions[base + 1] = from[1]
      positions[base + 2] = from[2]
      positions[base + 3] = to[0]
      positions[base + 4] = to[1]
      positions[base + 5] = to[2]
      color.set(EDGE_COLOR[edge.type] ?? DEFAULT_EDGE_COLOR)
      colors[base] = color.r
      colors[base + 1] = color.g
      colors[base + 2] = color.b
      colors[base + 3] = color.r
      colors[base + 4] = color.g
      colors[base + 5] = color.b
      cursor += 1
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [nodes, edges])

  return (
    <lineSegments geometry={geometry} visible={visible} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.25} depthWrite={false} />
    </lineSegments>
  )
}

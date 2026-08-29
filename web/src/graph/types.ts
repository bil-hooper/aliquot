// Shape of scripts/generate-synthetic-graph.mjs's output (and, later, the real
// build-time skeleton.json export -- plan sec 3.2: "ship a small skeleton.json
// (id, type, shell, position, label -- a few hundred KB gzipped)"). Positions
// are baked at generation time; the renderer never computes layout itself.

export interface GraphNode {
  id: string
  type: string
  shell: string
  label: string
  position: [number, number, number]
}

export interface GraphEdge {
  source: string
  target: string
  type: string
}

export interface SyntheticGraph {
  generatedAt: string
  generator: string
  seed: number
  targetNodes: number
  shellCounts: Record<string, number>
  nodeCount: number
  edgeCount: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

import { Canvas } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { useCallback, useState } from 'react'
import './App.css'
import type { GraphNode } from './graph/types'
import { useSyntheticGraph } from './graph/useSyntheticGraph'
import { Scene } from './scene/Scene'

declare global {
  interface Window {
    __r3fState?: RootState
  }
}

// Sprint 2 renderer spike (plan sec 5): InstancedMesh shells + LineSegments +
// OrbitControls, against the synthetic-graph generator's output, measuring
// FPS at ~15k nodes. This is a stress-test harness, not the site's UI --
// see docs/DECISIONS.md (2026-08-28) for the numbers this run produced and
// what they mean for the R3F-vs-vanilla-Three.js decision gate.
//
// Also carries the Sprint 3 GPU-picking spike (plan sec 3.2): hover/click
// resolve to a node via an offscreen render-target color-ID lookup, not
// raycasting -- see web/src/scene/PickingLayer.tsx and docs/DECISIONS.md.
export default function App() {
  const state = useSyntheticGraph('/data/synthetic-skeleton.json')
  const [fps, setFps] = useState(0)
  const [showEdges, setShowEdges] = useState(true)
  const [showOuterShell, setShowOuterShell] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [focusedNode, setFocusedNode] = useState<GraphNode | null>(null)
  const [pickLatencyMs, setPickLatencyMs] = useState<number | null>(null)

  const handleHoverChange = useCallback((node: GraphNode | null) => setHoveredNode(node), [])
  const handleFocusChange = useCallback((node: GraphNode | null) => setFocusedNode(node), [])
  const handlePickLatency = useCallback((ms: number) => setPickLatencyMs(ms), [])

  return (
    <div id="spike-root">
      <Canvas
        camera={{ position: [70, 45, 95], fov: 50, near: 0.1, far: 2000 }}
        gl={{ antialias: false }}
        onCreated={(rootState) => {
          // Dev-only debug hook (dead-code-eliminated in production builds):
          // lets an external script force synchronous, GPU-synced render
          // calls to measure real throughput even when the tab isn't visible
          // to a compositor, since requestAnimationFrame -- what the on-page
          // FPS meter relies on -- is throttled/paused for hidden tabs.
          if (import.meta.env.DEV) window.__r3fState = rootState
        }}
      >
        <color attach="background" args={['#05060a']} />
        {state.status === 'ready' && (
          <Scene
            graph={state.graph}
            showEdges={showEdges}
            showOuterShell={showOuterShell}
            onFpsSample={setFps}
            onHoverChange={handleHoverChange}
            onFocusChange={handleFocusChange}
            onPickLatency={handlePickLatency}
          />
        )}
      </Canvas>

      <div id="hud">
        <h1>Aliquot — renderer spike</h1>
        {state.status === 'loading' && <p>Loading synthetic graph...</p>}
        {state.status === 'error' && <p className="error">{state.message}</p>}
        {state.status === 'ready' && (
          <>
            <p>
              {state.graph.nodeCount.toLocaleString()} nodes, {state.graph.edgeCount.toLocaleString()} edges
            </p>
            <p className="fps" data-testid="fps-readout">
              {fps} fps
            </p>
            <label>
              <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
              Show edges ({state.graph.edgeCount.toLocaleString()})
            </label>
            <label>
              <input
                type="checkbox"
                checked={showOuterShell}
                onChange={(e) => setShowOuterShell(e.target.checked)}
              />
              Show shell 4 (faint outer, {(state.graph.shellCounts.originalPersonnel ?? 0).toLocaleString()}{' '}
              personnel)
            </label>
            <hr />
            <p data-testid="hover-readout">
              Hover: {hoveredNode ? `${hoveredNode.label} (${hoveredNode.shell})` : '—'}
            </p>
            <p data-testid="focus-readout">
              Focus: {focusedNode ? `${focusedNode.label} (${focusedNode.shell})` : '—'}
            </p>
            <p data-testid="pick-latency-readout">
              Last pick: {pickLatencyMs === null ? '—' : `${pickLatencyMs.toFixed(2)} ms`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

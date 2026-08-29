import { Canvas } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { useState } from 'react'
import './App.css'
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
export default function App() {
  const state = useSyntheticGraph('/data/synthetic-skeleton.json')
  const [fps, setFps] = useState(0)
  const [showEdges, setShowEdges] = useState(true)
  const [showOuterShell, setShowOuterShell] = useState(true)

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
          </>
        )}
      </div>
    </div>
  )
}

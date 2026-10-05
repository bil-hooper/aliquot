import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphNode } from '../graph/types'
import { DEFAULT_SHELL_STYLE, SHELL_STYLE } from '../graph/shellStyle'
import type { PickApi } from './PickingLayer'
import { PickingLayer } from './PickingLayer'

declare global {
  interface Window {
    __pickApi?: PickApi
  }
}

export interface PickingControllerProps {
  nodes: GraphNode[]
  onHoverChange: (node: GraphNode | null) => void
  onFocusChange: (node: GraphNode | null) => void
  onPickLatency: (ms: number) => void
}

// Wires GPU picking (PickingLayer) to real pointer input: hover is
// rAF-coalesced so a flood of pointermove events only triggers one pick per
// frame; click is a plain, immediate pick (and clicking empty space clears
// focus). Highlight markers here are deliberately separate meshes, not a
// change to ShellInstances' own per-instance colors -- this keeps the new,
// unproven picking path from risking the already-working visual layer.
export function PickingController({ nodes, onHoverChange, onFocusChange, onPickLatency }: PickingControllerProps) {
  const { gl } = useThree()
  const pickApiRef = useRef<PickApi | null>(null)
  const pendingMove = useRef<{ x: number; y: number } | null>(null)
  const rafHandle = useRef<number | null>(null)

  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [focused, setFocused] = useState<GraphNode | null>(null)

  const runPick = useCallback(
    (clientX: number, clientY: number) => {
      const api = pickApiRef.current
      if (!api) return null
      const start = performance.now()
      const result = api.pick(clientX, clientY)
      onPickLatency(performance.now() - start)
      return result
    },
    [onPickLatency],
  )

  useEffect(() => {
    const canvas = gl.domElement

    const flushHover = () => {
      rafHandle.current = null
      const pending = pendingMove.current
      pendingMove.current = null
      if (!pending) return
      const result = runPick(pending.x, pending.y)
      const node = result?.node ?? null
      setHovered((prev) => (prev?.id === node?.id ? prev : node))
      onHoverChange(node)
    }

    const handlePointerMove = (event: PointerEvent) => {
      pendingMove.current = { x: event.clientX, y: event.clientY }
      if (rafHandle.current === null) {
        rafHandle.current = requestAnimationFrame(flushHover)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const result = runPick(event.clientX, event.clientY)
      const node = result?.node ?? null
      setFocused(node)
      onFocusChange(node)
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerdown', handlePointerDown)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current)
    }
  }, [gl, onFocusChange, onHoverChange, runPick])

  return (
    <>
      <PickingLayer
        nodes={nodes}
        onReady={(api) => {
          pickApiRef.current = api
          // Dev-only verification hook, dead-code-eliminated in production
          // builds (see the identical pattern/rationale for __r3fState in App.tsx).
          if (import.meta.env.DEV) window.__pickApi = api
        }}
      />
      <HighlightMarker node={hovered} color="#ffffff" scale={1.6} />
      <HighlightMarker node={focused} color="#ff3b7f" scale={2.1} />
    </>
  )
}

function HighlightMarker({ node, color, scale }: { node: GraphNode | null; color: string; scale: number }) {
  if (!node) return null
  const style = SHELL_STYLE[node.shell] ?? DEFAULT_SHELL_STYLE
  return (
    <mesh position={node.position}>
      <sphereGeometry args={[style.radius * scale, 12, 8]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.85} depthWrite={false} />
    </mesh>
  )
}

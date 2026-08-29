import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

interface FpsMeterProps {
  onSample: (fps: number) => void
}

// Rolling FPS readout, sampled twice a second so the HUD re-render doesn't
// itself compete with the render loop being measured.
export function FpsMeter({ onSample }: FpsMeterProps) {
  const frames = useRef(0)
  const windowStart = useRef(performance.now())

  useFrame(() => {
    frames.current += 1
    const now = performance.now()
    const elapsed = now - windowStart.current
    if (elapsed >= 500) {
      onSample(Math.round((frames.current * 1000) / elapsed))
      frames.current = 0
      windowStart.current = now
    }
  })

  return null
}

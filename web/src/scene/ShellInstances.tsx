import { Instance, Instances } from '@react-three/drei'
import { useMemo } from 'react'
import type { GraphNode } from '../graph/types'
import { DEFAULT_SHELL_STYLE, SHELL_STYLE } from '../graph/shellStyle'

interface ShellInstancesProps {
  shell: string
  nodes: GraphNode[]
}

// One InstancedMesh per shell -- one draw call per shell, per plan sec 3.2's
// required-techniques list. drei's <Instances>/<Instance> is a thin wrapper
// over THREE.InstancedMesh: it still produces exactly one draw call, it just
// avoids hand-rolling the imperative matrix-buffer bookkeeping.
export function ShellInstances({ shell, nodes }: ShellInstancesProps) {
  const style = SHELL_STYLE[shell] ?? DEFAULT_SHELL_STYLE
  const positions = useMemo(() => nodes.map((n) => n.position), [nodes])

  if (positions.length === 0) return null

  return (
    <Instances limit={positions.length} range={positions.length} frustumCulled={false}>
      <sphereGeometry args={[style.radius, 8, 6]} />
      <meshBasicMaterial
        color={style.color}
        transparent={style.opacity < 1}
        opacity={style.opacity}
        depthWrite={style.opacity >= 1}
      />
      {positions.map((position, i) => (
        <Instance key={nodes[i].id} position={position} />
      ))}
    </Instances>
  )
}

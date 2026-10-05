import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GraphNode } from '../graph/types'
import { DEFAULT_SHELL_STYLE, SHELL_STYLE } from '../graph/shellStyle'

// Hand-written, not MeshBasicMaterial: three.js's built-in materials bake
// tone-mapping and linear->sRGB output-color-space conversion into their
// compiled shaders, which would corrupt the exact byte values this encodes.
// A bare ShaderMaterial gets none of that -- only the instancing attribute
// declarations (instanceMatrix / instanceColor), which the renderer injects
// for *any* material on an InstancedMesh, built-in or not.
const PICK_VERTEX_SHADER = `
  varying vec3 vPickColor;
  void main() {
    vec3 transformed = position;
    #ifdef USE_INSTANCING
      transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vPickColor = instanceColor;
    #else
      vPickColor = vec3(0.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const PICK_FRAGMENT_SHADER = `
  varying vec3 vPickColor;
  void main() {
    gl_FragColor = vec4(vPickColor, 1.0);
  }
`

// Independent of the *visual* per-shell radius in shellStyle.ts -- keeps
// tiny/faint nodes (2a, 3b, 4) comfortably clickable instead of needing
// pixel-perfect aim.
const MIN_PICK_RADIUS = 0.45

export interface PickResult {
  node: GraphNode
  globalId: number
}

export interface PickApi {
  pick: (clientX: number, clientY: number) => PickResult | null
}

interface PickingLayerProps {
  nodes: GraphNode[]
  onReady: (api: PickApi) => void
}

// GPU picking per plan sec 3.2: render instance IDs as colors to an
// offscreen 1x1 render target positioned at the cursor (via the camera's
// setViewOffset -- a sub-rectangle of the full frustum, not a downscaled
// full-frame render), then read back that one pixel. O(1) regardless of
// node count, unlike raycasting every instance every frame.
//
// This never touches the visible scene -- it builds and renders its own
// parallel THREE.Scene purely for color-ID lookups, exposed to the caller
// as a plain `pick(clientX, clientY)` function via onReady. That keeps the
// already-working visual layer (ShellInstances/EdgeLines) completely
// unmodified by this spike.
export function PickingLayer({ nodes, onReady }: PickingLayerProps) {
  const { gl, camera } = useThree()
  const renderTarget = useMemo(() => new THREE.WebGLRenderTarget(1, 1), [])
  const pixelBuffer = useMemo(() => new Uint8Array(4), [])

  const { pickingScene, pickMaterial, nodesByGlobalId } = useMemo(() => {
    const byShell = new Map<string, GraphNode[]>()
    for (const node of nodes) {
      const bucket = byShell.get(node.shell)
      if (bucket) bucket.push(node)
      else byShell.set(node.shell, [node])
    }

    const flat: GraphNode[] = []
    const scene = new THREE.Scene()
    const material = new THREE.ShaderMaterial({
      vertexShader: PICK_VERTEX_SHADER,
      fragmentShader: PICK_FRAGMENT_SHADER,
    })
    const matrix = new THREE.Matrix4()

    for (const [shell, shellNodes] of byShell) {
      const style = SHELL_STYLE[shell] ?? DEFAULT_SHELL_STYLE
      const radius = Math.max(style.radius, MIN_PICK_RADIUS)
      const geometry = new THREE.SphereGeometry(radius, 8, 6)
      const mesh = new THREE.InstancedMesh(geometry, material, shellNodes.length)
      const colors = new Float32Array(shellNodes.length * 3)

      shellNodes.forEach((node, i) => {
        matrix.setPosition(node.position[0], node.position[1], node.position[2])
        mesh.setMatrixAt(i, matrix)
        const encoded = flat.length + 1 // reserve 0 as "no hit"
        flat.push(node)
        colors[i * 3] = (encoded & 0xff) / 255
        colors[i * 3 + 1] = ((encoded >> 8) & 0xff) / 255
        colors[i * 3 + 2] = ((encoded >> 16) & 0xff) / 255
      })

      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
      scene.add(mesh)
    }

    return { pickingScene: scene, pickMaterial: material, nodesByGlobalId: flat }
  }, [nodes])

  const pickRef = useRef<PickApi['pick']>(() => null)

  useEffect(() => {
    pickRef.current = (clientX, clientY) => {
      const canvas = gl.domElement
      const rect = canvas.getBoundingClientRect()
      const px = Math.floor((clientX - rect.left) * (canvas.width / rect.width))
      const py = Math.floor((clientY - rect.top) * (canvas.height / rect.height))
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null

      const cam = camera as THREE.PerspectiveCamera
      cam.setViewOffset(canvas.width, canvas.height, px, py, 1, 1)

      const previousTarget = gl.getRenderTarget()
      gl.setRenderTarget(renderTarget)
      gl.render(pickingScene, cam)
      gl.readRenderTargetPixels(renderTarget, 0, 0, 1, 1, pixelBuffer)
      gl.setRenderTarget(previousTarget)
      cam.clearViewOffset()

      const encoded = pixelBuffer[0] | (pixelBuffer[1] << 8) | (pixelBuffer[2] << 16)
      if (encoded === 0) return null
      const node = nodesByGlobalId[encoded - 1]
      return node ? { node, globalId: encoded - 1 } : null
    }
  }, [gl, camera, pickingScene, nodesByGlobalId, renderTarget, pixelBuffer])

  useEffect(() => {
    onReady({ pick: (x, y) => pickRef.current(x, y) })
  }, [onReady])

  useEffect(() => {
    return () => {
      renderTarget.dispose()
      pickMaterial.dispose()
      pickingScene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.geometry.dispose()
      })
    }
  }, [pickingScene, pickMaterial, renderTarget])

  return null
}

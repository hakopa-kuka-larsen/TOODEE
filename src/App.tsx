import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Character } from './components/Character'
import { Level } from './components/Level'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const characterRef = useRef<Character | null>(null)
  const levelRef = useRef<Level | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0x87ceeb) // Sky blue background

    // Camera setup with adjusted view size
    const viewSize = 10 // Smaller view size to make everything appear larger
    const aspectRatio = window.innerWidth / window.innerHeight
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspectRatio,
      viewSize * aspectRatio,
      viewSize,
      -viewSize,
      0.1,
      1000
    )
    camera.position.z = 5

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.current.appendChild(renderer.domElement)

    // Create level
    const level = new Level(scene)
    levelRef.current = level

    // Create character with original scale
    const character = new Character(scene, 2.25)
    characterRef.current = character

    // Handle keyboard input
    const keys: { [key: string]: boolean } = {}
    const keyState: { [key: string]: boolean } = {}

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true
      if (!keyState[e.code]) {
        keyState[e.code] = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false
      keyState[e.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const aspectRatio = width / height

      camera.left = -viewSize * aspectRatio
      camera.right = viewSize * aspectRatio
      camera.top = viewSize
      camera.bottom = -viewSize
      camera.updateProjectionMatrix()

      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Animation loop
    let lastTime = 0
    const animate = (time: number) => {
      requestAnimationFrame(animate)
      const deltaTime = (time - lastTime) / 1000
      lastTime = time

      if (characterRef.current) {
        // Update character with proper input object
        characterRef.current.update(deltaTime, {
          keys,
          isKeyDown: (key: string) => keys[key] || false,
          isKeyPressed: (key: string) => keyState[key] || false,
        })
      }

      renderer.render(scene, camera)
    }

    animate(0)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      containerRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} />
}

export default App

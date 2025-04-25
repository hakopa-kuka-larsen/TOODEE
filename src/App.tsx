import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Character } from './components/Character'
import { PushableObject } from './components/PushableObject'

function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const keysRef = useRef<{ [key: string]: boolean }>({})
  const prevKeysRef = useRef<{ [key: string]: boolean }>({})
  const characterRef = useRef<Character | null>(null)
  const pushableObjectsRef = useRef<PushableObject[]>([])

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()

    // Calculate camera dimensions to maintain pixel scale
    const pixelScale = 2.25 // Increased from 1.5 to 2.25 for 1.5x size
    const aspectRatio = window.innerWidth / window.innerHeight
    const viewHeight = 7.5 // Reduced from 10 to 7.5 for closer view
    const viewWidth = viewHeight * aspectRatio

    const camera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      1000
    )

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable antialiasing for pixel art
      alpha: true, // Enable alpha channel
    })
    renderer.setClearColor(0x000000, 0) // Make background transparent
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    mountRef.current.appendChild(renderer.domElement)

    // Set camera position
    camera.position.z = 10
    camera.position.y = 0
    camera.lookAt(0, 0, 0)

    // Create character
    const character = new Character(scene, pixelScale)
    characterRef.current = character

    // Create pushable objects
    const pushableObjects = [
      new PushableObject(scene, 2, 0, 1.5, 1.5, 0xff0000), // Red box
      new PushableObject(scene, -2, 0, 1.5, 1.5, 0x00ff00), // Green box
      new PushableObject(scene, 0, 2, 1.5, 1.5, 0x0000ff), // Blue box
      new PushableObject(scene, 0, -2, 1.5, 1.5, 0xffff00), // Yellow box
    ]
    pushableObjectsRef.current = pushableObjects

    // Add pushable objects to character
    pushableObjects.forEach((object) => character.addPushableObject(object))

    // Handle keyboard input
    const handleKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.code] = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const newAspectRatio = width / height
      const newViewWidth = viewHeight * newAspectRatio

      camera.left = -newViewWidth / 2
      camera.right = newViewWidth / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.updateProjectionMatrix()

      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Animation loop
    let lastTime = 0
    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000
      lastTime = time

      // Create input object with required methods
      const input = {
        keys: keysRef.current,
        isKeyDown: (key: string) => keysRef.current[key] === true,
        isKeyPressed: (key: string) =>
          keysRef.current[key] === true && prevKeysRef.current[key] !== true,
      }

      character.update(delta, input)

      // Update previous keys state
      prevKeysRef.current = { ...keysRef.current }

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate(0)

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
      mountRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        backgroundColor: '#87CEEB', // Match scene background color
      }}
    />
  )
}

export default App

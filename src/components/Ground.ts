import * as THREE from 'three'

export class Ground {
  private mesh: THREE.Mesh

  constructor(scene: THREE.Scene) {
    // Create ground platform
    const groundGeometry = new THREE.BoxGeometry(20, 0.5, 1)
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    this.mesh = new THREE.Mesh(groundGeometry, groundMaterial)
    this.mesh.position.set(0, -3.8, 0) // Position slightly below character's ground level

    scene.add(this.mesh)
  }

  // Method to get the ground's y position (useful for character collision)
  getGroundLevel(): number {
    return this.mesh.position.y + 0.25 // Return top of ground (position + half height)
  }

  // Method to get the ground's width (useful for bounds checking)
  getWidth(): number {
    return 20 // Same as geometry width
  }
}

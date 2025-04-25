import * as THREE from 'three'

export class Platform {
  private mesh: THREE.Mesh
  private width: number
  private height: number = 0.5

  constructor(
    scene: THREE.Scene,
    x: number,
    y: number,
    width: number,
    color: number = 0x8b4513
  ) {
    this.width = width

    // Create platform
    const geometry = new THREE.BoxGeometry(width, this.height, 1)
    const material = new THREE.MeshBasicMaterial({ color })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.set(x, y, 0)

    scene.add(this.mesh)
  }

  // Get the top surface position for collision detection
  getTopLevel(): number {
    return this.mesh.position.y + this.height / 2
  }

  // Get the bottom surface position for collision detection
  getBottomLevel(): number {
    return this.mesh.position.y - this.height / 2
  }

  // Get horizontal bounds for collision detection
  getBounds(): { left: number; right: number } {
    return {
      left: this.mesh.position.x - this.width / 2,
      right: this.mesh.position.x + this.width / 2,
    }
  }

  // Check if a point is within the platform's horizontal bounds
  isWithinBounds(x: number): boolean {
    const bounds = this.getBounds()
    return x >= bounds.left && x <= bounds.right
  }
}

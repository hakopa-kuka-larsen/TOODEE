import * as THREE from 'three'

export class PushableObject {
  private mesh: THREE.Mesh
  private width: number
  private height: number
  private isBeingPushed: boolean = false
  private pushDirection: THREE.Vector2 = new THREE.Vector2(0, 0)
  private pushSpeed: number = 1.5 // Slower than character's push speed
  private velocity: THREE.Vector2 = new THREE.Vector2(0, 0)
  private deceleration: number = 8 // How quickly the box slows down
  private momentum: number = 0.8 // How much momentum is preserved when changing direction

  constructor(
    scene: THREE.Scene,
    x: number,
    y: number,
    width: number = 1,
    height: number = 1,
    color: number = 0x8b4513 // Default brown color
  ) {
    this.width = width
    this.height = height

    // Create a simple box geometry for the pushable object
    const geometry = new THREE.BoxGeometry(width, height, 1)
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.set(x, y, 0)
    scene.add(this.mesh)
  }

  getPosition(): THREE.Vector2 {
    return new THREE.Vector2(this.mesh.position.x, this.mesh.position.y)
  }

  getBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    return {
      min: new THREE.Vector2(
        this.mesh.position.x - this.width / 2,
        this.mesh.position.y - this.height / 2
      ),
      max: new THREE.Vector2(
        this.mesh.position.x + this.width / 2,
        this.mesh.position.y + this.height / 2
      ),
    }
  }

  startPush(direction: THREE.Vector2) {
    this.isBeingPushed = true
    this.pushDirection.copy(direction)
  }

  stopPush() {
    this.isBeingPushed = false
    this.pushDirection.set(0, 0)
  }

  update(deltaTime: number) {
    if (this.isBeingPushed) {
      // Calculate target velocity based on push direction
      const targetVelocity = this.pushDirection
        .clone()
        .multiplyScalar(this.pushSpeed)

      // Apply momentum when changing direction
      this.velocity.lerp(targetVelocity, 1 - this.momentum)
    } else if (this.velocity.length() > 0) {
      // Apply deceleration when not being pushed
      const deceleration = this.deceleration * deltaTime
      const currentSpeed = this.velocity.length()
      if (currentSpeed > deceleration) {
        this.velocity.multiplyScalar(1 - deceleration / currentSpeed)
      } else {
        this.velocity.set(0, 0)
      }
    }

    // Update position based on velocity
    this.mesh.position.x += this.velocity.x * deltaTime
    this.mesh.position.y += this.velocity.y * deltaTime
  }

  dispose() {
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((material) => material.dispose())
    } else {
      this.mesh.material.dispose()
    }
  }
}

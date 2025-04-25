import * as THREE from 'three'

export class Level {
  private platforms: THREE.Mesh[] = []

  constructor(scene: THREE.Scene) {
    // Create ground with adjusted height
    this.createPlatform(scene, 0, -3.25, 20, 0.75, 0x000000)

    // Create some example platforms with adjusted heights
    this.createPlatform(scene, -4, 0, 3, 0.75, 0x333333)
    this.createPlatform(scene, 4, 1, 3, 0.75, 0x333333)
    this.createPlatform(scene, 0, 2, 3, 0.75, 0x333333)
  }

  private createPlatform(
    scene: THREE.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number
  ) {
    const geometry = new THREE.BoxGeometry(width, height, 1)
    const material = new THREE.MeshBasicMaterial({ color })
    const platform = new THREE.Mesh(geometry, material)
    platform.position.set(x, y, 0)
    scene.add(platform)
    this.platforms.push(platform)
  }

  checkCollision(
    position: THREE.Vector3,
    velocity: THREE.Vector2,
    size: { width: number; height: number }
  ): {
    collided: boolean
    adjustedPosition: THREE.Vector3
    adjustedVelocity: THREE.Vector2
  } {
    const halfWidth = size.width / 2
    const halfHeight = size.height / 2

    // Create character bounds
    const characterBounds = {
      left: position.x - halfWidth,
      right: position.x + halfWidth,
      top: position.y + halfHeight,
      bottom: position.y - halfHeight,
    }

    let collided = false
    const adjustedPosition = position.clone()
    const adjustedVelocity = velocity.clone()

    // Check collision with each platform
    for (const platform of this.platforms) {
      const platformBounds = {
        left: platform.position.x - platform.geometry.parameters.width / 2,
        right: platform.position.x + platform.geometry.parameters.width / 2,
        top: platform.position.y + platform.geometry.parameters.height / 2,
        bottom: platform.position.y - platform.geometry.parameters.height / 2,
      }

      // Check for collision
      if (
        characterBounds.right > platformBounds.left &&
        characterBounds.left < platformBounds.right &&
        characterBounds.top > platformBounds.bottom &&
        characterBounds.bottom < platformBounds.top
      ) {
        collided = true

        // Determine collision side and adjust position
        const overlapLeft = characterBounds.right - platformBounds.left
        const overlapRight = platformBounds.right - characterBounds.left
        const overlapTop = characterBounds.top - platformBounds.bottom
        const overlapBottom = platformBounds.top - characterBounds.bottom

        const minOverlap = Math.min(
          overlapLeft,
          overlapRight,
          overlapTop,
          overlapBottom
        )

        if (minOverlap === overlapTop) {
          // Collision from below
          adjustedPosition.y = platformBounds.bottom - halfHeight
          adjustedVelocity.y = Math.min(0, adjustedVelocity.y)
        } else if (minOverlap === overlapBottom) {
          // Collision from above
          adjustedPosition.y = platformBounds.top + halfHeight
          adjustedVelocity.y = 0
        } else if (minOverlap === overlapLeft) {
          // Collision from right
          adjustedPosition.x = platformBounds.left - halfWidth
          adjustedVelocity.x = Math.min(0, adjustedVelocity.x)
        } else if (minOverlap === overlapRight) {
          // Collision from left
          adjustedPosition.x = platformBounds.right + halfWidth
          adjustedVelocity.x = Math.max(0, adjustedVelocity.x)
        }
      }
    }

    return {
      collided,
      adjustedPosition,
      adjustedVelocity,
    }
  }
}

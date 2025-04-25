import * as THREE from 'three'
import { PushableObject } from './PushableObject'

type Direction = 'left' | 'right'
type AnimationType = 'stand' | 'walk' | 'run' | 'jump'
type Frame = { x: number; y: number; w: number; h: number }
type Input = {
  keys: { [key: string]: boolean }
  isKeyDown: (key: string) => boolean
  isKeyPressed: (key: string) => boolean
}

export class Character {
  private sprite: THREE.Sprite
  private spriteMap: THREE.Texture
  private spriteMaterial: THREE.SpriteMaterial
  private currentAnimation: AnimationType = 'stand'
  private currentDirection: Direction = 'right'
  private frameIndex: number = 0
  private animationTimer: number = 0
  private isRunning: boolean = false
  private isJumping: boolean = false
  private isPushing: boolean = false
  private jumpVelocity: number = 0
  private jumpHeight: number = 2
  private gravity: number = 15
  private groundY: number = -2.75 // Adjusted ground position to account for sprite height

  // Movement properties
  private velocity = new THREE.Vector2(0, 0)
  private moveSpeed = { walk: 4, run: 8 }
  private deceleration = 15 // How quickly the character slows down
  private wasMoving = false // Track if character was moving last frame
  private momentum = 0.8 // How much momentum is preserved when changing direction (0-1)
  private directionalChangePenalty = 0.5 // How much speed is reduced when changing direction (0-1)

  // Animation frame coordinates
  private animations: Record<AnimationType, Record<Direction, Frame[]>> = {
    stand: {
      right: [{ x: 0, y: 128, w: 64, h: 64 }],
      left: [{ x: 0, y: 192, w: 64, h: 64 }],
    },
    walk: {
      right: Array.from({ length: 6 }, (_, i) => ({
        x: i * 64,
        y: 384,
        w: 64,
        h: 64,
      })),
      left: Array.from({ length: 6 }, (_, i) => ({
        x: i * 64,
        y: 448,
        w: 64,
        h: 64,
      })),
    },
    run: {
      right: [0, 1, 6, 3, 4, 7].map((i) => ({
        x: i * 64,
        y: 384,
        w: 64,
        h: 64,
      })),
      left: [0, 1, 6, 3, 4, 7].map((i) => ({
        x: i * 64,
        y: 448,
        w: 64,
        h: 64,
      })),
    },
    jump: {
      right: [
        { x: 5 * 64, y: 128, w: 64, h: 64 }, // Frame 1: crouch
        { x: 6 * 64, y: 128, w: 64, h: 64 }, // Frame 2: rising
        { x: 7 * 64, y: 128, w: 64, h: 64 }, // Frame 3: airborne
        { x: 5 * 64, y: 128, w: 64, h: 64 }, // Frame 4: landing (same as frame 1)
      ],
      left: [
        { x: 5 * 64, y: 192, w: 64, h: 64 },
        { x: 6 * 64, y: 192, w: 64, h: 64 },
        { x: 7 * 64, y: 192, w: 64, h: 64 },
        { x: 5 * 64, y: 192, w: 64, h: 64 },
      ],
    },
  }

  private animationTiming: Record<Exclude<AnimationType, 'stand'>, number[]> = {
    walk: [135, 135, 135, 135, 135, 135],
    run: [80, 55, 125, 80, 55, 125],
    jump: [300, 150, 100, 300],
  }

  private pushableObjects: PushableObject[] = []
  private currentPushableObject: PushableObject | null = null
  private pushDistance: number = 1.2 // Distance at which character can push objects

  constructor(scene: THREE.Scene, pixelScale: number = 2) {
    // Load sprite sheet
    const textureLoader = new THREE.TextureLoader()

    this.spriteMap = textureLoader.load(
      '/assets/sprites/char_a_p1_0bas_humn_v01.png',
      (texture) => {
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        this.updateTextureFrame(this.animations.stand.right[0])
      }
    )

    // Create material with transparency
    this.spriteMaterial = new THREE.SpriteMaterial({
      map: this.spriteMap,
      transparent: true,
      alphaTest: 0.1,
    })

    this.sprite = new THREE.Sprite(this.spriteMaterial)

    // Scale the sprite to match pixel size
    this.sprite.scale.set(pixelScale, pixelScale, 1)

    // Set initial position
    this.sprite.position.set(0, this.groundY, 0)

    // Add to scene
    scene.add(this.sprite)
  }

  private updateTextureFrame(frame: Frame) {
    const texture = this.spriteMap

    // Calculate UV coordinates
    const u = frame.x / 512
    const v = 1 - frame.y / 512
    const w = frame.w / 512
    const h = frame.h / 512

    texture.offset.set(u, v - h)
    texture.repeat.set(w, h)
  }

  addPushableObject(object: PushableObject) {
    this.pushableObjects.push(object)
  }

  private checkPushableObjectCollision(
    direction: THREE.Vector2
  ): PushableObject | null {
    const characterBounds = {
      min: new THREE.Vector2(
        this.sprite.position.x - 0.5,
        this.sprite.position.y - 0.5
      ),
      max: new THREE.Vector2(
        this.sprite.position.x + 0.5,
        this.sprite.position.y + 0.5
      ),
    }

    // Check each pushable object
    for (const object of this.pushableObjects) {
      const objectBounds = object.getBounds()

      // Check if character is facing the object and within push distance
      const objectPos = object.getPosition()
      const toObject = new THREE.Vector2(
        objectPos.x - this.sprite.position.x,
        objectPos.y - this.sprite.position.y
      ).normalize()

      const dotProduct = direction.dot(toObject)
      const distance = this.sprite.position.distanceTo(
        new THREE.Vector3(objectPos.x, objectPos.y, 0)
      )

      if (dotProduct > 0.7 && distance < this.pushDistance) {
        return object
      }
    }

    return null
  }

  update(deltaTime: number, input: Input) {
    // Handle jumping
    if (input.isKeyPressed('Space') && !this.isJumping) {
      this.isJumping = true
      this.jumpVelocity = Math.sqrt(2 * this.gravity * this.jumpHeight)
    }

    if (this.isJumping) {
      this.sprite.position.y += this.jumpVelocity * deltaTime
      this.jumpVelocity -= this.gravity * deltaTime

      if (this.sprite.position.y <= this.groundY) {
        this.sprite.position.y = this.groundY
        this.isJumping = false
        this.jumpVelocity = 0
      }
    }

    // Movement input (only left/right)
    const moveInput = new THREE.Vector2(0, 0)
    if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight'))
      moveInput.x += 1
    if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft'))
      moveInput.x -= 1

    // Normalize movement
    if (moveInput.length() > 0) moveInput.normalize()

    // Check for pushable objects when moving
    if (moveInput.length() > 0) {
      const pushableObject = this.checkPushableObjectCollision(moveInput)

      if (pushableObject) {
        this.isPushing = true
        this.currentPushableObject = pushableObject
        pushableObject.startPush(moveInput)
      } else {
        this.isPushing = false
        if (this.currentPushableObject) {
          this.currentPushableObject.stopPush()
          this.currentPushableObject = null
        }
      }
    } else {
      this.isPushing = false
      if (this.currentPushableObject) {
        this.currentPushableObject.stopPush()
        this.currentPushableObject = null
      }
    }

    // Set running state
    this.isRunning = input.isKeyDown('ShiftLeft')
    const currentSpeed = this.isRunning
      ? this.moveSpeed.run
      : this.moveSpeed.walk

    // Calculate directional change penalty
    let speedMultiplier = 1
    if (this.velocity.length() > 0 && moveInput.length() > 0) {
      const currentDirection = this.velocity.clone().normalize()
      const targetDirection = moveInput.clone()
      const dotProduct = currentDirection.dot(targetDirection)

      // If moving in opposite direction (dot product close to -1)
      if (dotProduct < -0.5) {
        speedMultiplier = this.directionalChangePenalty
      }
    }

    // Apply movement
    if (moveInput.length() > 0) {
      // Accelerate
      this.velocity.x = moveInput.x * currentSpeed * speedMultiplier
    } else {
      // Decelerate
      this.velocity.x *= Math.max(0, 1 - this.deceleration * deltaTime)
    }

    // Apply velocity to position
    this.sprite.position.x += this.velocity.x * deltaTime

    // Update animation based on movement
    if (this.velocity.x !== 0) {
      this.currentDirection = this.velocity.x > 0 ? 'right' : 'left'
      this.currentAnimation = this.isRunning ? 'run' : 'walk'
    } else {
      this.currentAnimation = 'stand'
    }

    // Update animation frame
    this.animationTimer += deltaTime * 1000 // Convert to milliseconds
    if (this.currentAnimation !== 'stand') {
      const timing = this.animationTiming[this.currentAnimation]
      if (this.animationTimer >= timing[this.frameIndex]) {
        this.animationTimer = 0
        this.frameIndex = (this.frameIndex + 1) % timing.length
      }
    }

    // Get current animation frames
    const animationFrames =
      this.animations[this.currentAnimation]?.[this.currentDirection]
    if (!animationFrames || animationFrames.length === 0) {
      // Fallback to stand animation if current animation doesn't exist
      this.currentAnimation = 'stand'
      this.frameIndex = 0
      return
    }

    // Ensure frameIndex is within bounds
    this.frameIndex = this.frameIndex % animationFrames.length

    // Update sprite texture coordinates
    const frame = animationFrames[this.frameIndex]
    if (frame) {
      this.updateTextureFrame(frame)
    }

    // Update pushable objects
    if (this.currentPushableObject) {
      this.currentPushableObject.update(deltaTime)
    }
  }
}

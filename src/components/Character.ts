import * as THREE from 'three'
import { PushableObject } from './PushableObject'
import { Ground } from './Ground'
import { Platform } from './Platform'

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
  private jumpHeight: number = 4
  private gravity: number = 15
  private ground: Ground
  private platforms: Platform[] = []

  // Character dimensions
  private width: number = 1
  private height: number = 1

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

  constructor(scene: THREE.Scene, ground: Ground, pixelScale: number = 2) {
    this.ground = ground

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

    // Set initial position to be just above the ground
    const groundLevel = ground.getGroundLevel()
    this.sprite.position.set(0, groundLevel + this.height / 1, 0)

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

  addPlatform(platform: Platform) {
    this.platforms.push(platform)
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
    // Store previous position for collision resolution
    const previousY = this.sprite.position.y

    // Apply gravity
    if (!this.isOnGround()) {
      this.velocity.y -= this.gravity * deltaTime
    }

    // Handle jumping
    if (input.isKeyPressed('Space') && this.isOnGround()) {
      this.isJumping = true
      this.velocity.y = Math.sqrt(2 * this.gravity * this.jumpHeight)
    }

    // Movement input (only left/right)
    const moveInput = new THREE.Vector2(0, 0)
    if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight'))
      moveInput.x += 1
    if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft'))
      moveInput.x -= 1

    // Normalize movement
    if (moveInput.length() > 0) moveInput.normalize()

    // Set running state
    this.isRunning = input.isKeyDown('ShiftLeft')
    const currentSpeed = this.isRunning
      ? this.moveSpeed.run
      : this.moveSpeed.walk

    // Calculate directional change penalty
    let speedMultiplier = 1
    if (this.velocity.x !== 0 && moveInput.length() > 0) {
      const currentDirection = Math.sign(this.velocity.x)
      const targetDirection = Math.sign(moveInput.x)

      // If moving in opposite direction
      if (currentDirection !== targetDirection) {
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

    // Update position
    this.sprite.position.x += this.velocity.x * deltaTime
    this.sprite.position.y += this.velocity.y * deltaTime

    // Check ground and platform collisions
    let isOnSurface = false
    let surfaceLevel = -Infinity

    // Check ground first
    const groundLevel = this.ground.getGroundLevel()
    if (this.sprite.position.y - this.height / 2 < groundLevel) {
      surfaceLevel = groundLevel
      isOnSurface = true
    }

    // Check platforms
    for (const platform of this.platforms) {
      if (platform.isWithinBounds(this.sprite.position.x)) {
        const platformTop = platform.getTopLevel()

        // Only collide if we're falling onto the platform
        if (
          this.velocity.y <= 0 &&
          previousY - this.height / 2 >= platformTop &&
          this.sprite.position.y - this.height / 2 < platformTop
        ) {
          // If this platform is higher than our current surface, use it instead
          if (platformTop > surfaceLevel) {
            surfaceLevel = platformTop
            isOnSurface = true
          }
        }
      }
    }

    // Apply collision resolution if we hit a surface
    if (isOnSurface) {
      this.sprite.position.y = surfaceLevel + this.height / 2
      this.velocity.y = 0
      this.isJumping = false
    }

    // Update animation based on state
    let newAnimation: AnimationType = 'stand'

    if (!this.isOnGround()) {
      newAnimation = 'jump'
    } else if (Math.abs(this.velocity.x) > 0.1) {
      newAnimation = this.isRunning ? 'run' : 'walk'
    }

    // Update direction based on movement
    if (this.velocity.x !== 0) {
      this.currentDirection = this.velocity.x > 0 ? 'right' : 'left'
    }

    // Update animation if it changed
    if (newAnimation !== this.currentAnimation) {
      this.currentAnimation = newAnimation
      this.frameIndex = 0
      this.animationTimer = 0
    }

    // Update animation frame
    this.animationTimer += deltaTime * 1000
    if (this.currentAnimation !== 'stand') {
      const timing = this.animationTiming[this.currentAnimation]
      if (this.animationTimer >= timing[this.frameIndex]) {
        this.animationTimer = 0
        this.frameIndex = (this.frameIndex + 1) % timing.length
      }
    }

    // Update sprite texture
    const frame =
      this.animations[this.currentAnimation][this.currentDirection][
        this.frameIndex
      ]
    this.updateTextureFrame(frame)

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
  }

  private isOnGround(): boolean {
    // Check ground
    if (
      this.sprite.position.y - this.height / 2 <=
      this.ground.getGroundLevel() + 0.01
    ) {
      return true
    }

    // Check platforms
    for (const platform of this.platforms) {
      if (platform.isWithinBounds(this.sprite.position.x)) {
        const platformTop = platform.getTopLevel()
        if (
          Math.abs(this.sprite.position.y - this.height / 2 - platformTop) <=
          0.01
        ) {
          return true
        }
      }
    }

    return false
  }

  getPosition(): THREE.Vector3 {
    return this.sprite.position.clone()
  }
}

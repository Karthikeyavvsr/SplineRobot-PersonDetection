'use client'

import { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react'
import type { Application, SPEObject } from '@splinetool/runtime'
import { gsap } from 'gsap'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface RobotParts {
  head: SPEObject | null
  rightArm: SPEObject | null
  leftArm: SPEObject | null
  rightHand: SPEObject | null
  leftHand: SPEObject | null
  rightShoulder: SPEObject | null
  leftShoulder: SPEObject | null
  body: SPEObject | null
}

interface InteractiveSplineProps {
  scene: string
  className?: string
  faceX?: number // -1 (left) to 1 (right)
  faceY?: number // -1 (top) to 1 (bottom)
  onLoad?: (spline: Application) => void
  isPersonNear?: boolean // true when person is close (for face mimicking)
  personDetected?: boolean // true when any person is detected (for arm wave)
}

export function InteractiveSplineWithWave({
  scene,
  className,
  faceX = 0,
  faceY = 0,
  onLoad,
  isPersonNear = false,
  personDetected = false
}: InteractiveSplineProps) {
  const splineRef = useRef<Application | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const idleAnimationRef = useRef<number | undefined>(undefined)
  const robotPartsRef = useRef<RobotParts>({
    head: null,
    rightArm: null,
    leftArm: null,
    rightHand: null,
    leftHand: null,
    rightShoulder: null,
    leftShoulder: null,
    body: null
  })
  const [isWaving, setIsWaving] = useState(false)
  const [robotPartsFound, setRobotPartsFound] = useState<string[]>([])
  const previousPersonDetected = useRef(false)
  const lastWaveTime = useRef(0)
  const WAVE_COOLDOWN = 5000 // Increased to 5 second cooldown between waves
  const consecutiveWaveCount = useRef(0)
  const MAX_CONSECUTIVE_WAVES = 3 // Max 3 consecutive waves
  const armTrackingRef = useRef({ enabled: false, lastPositions: null })
  
  // Add consistent base pose storage
  const basePoseRef = useRef<{
    rightArm: { x: number, y: number, z: number } | null,
    rightHand: { x: number, y: number, z: number } | null,
    leftHand: { x: number, y: number, z: number } | null,
    rightShoulder: { x: number, y: number, z: number } | null,
    calibrated: boolean
  }>({ 
    rightArm: null, 
    rightHand: null, 
    leftHand: null, 
    rightShoulder: null,
    calibrated: false 
  })

  // Smooth interpolation for robot head rotation
  const currentRotationRef = useRef({ x: 0, y: 0 })
  const targetRotationRef = useRef({ x: 0, y: 0 })
  
  // Position drift correction system
  const positionDriftRef = useRef({
    rightArmDrift: { x: 0, y: 0, z: 0 },
    rightHandDrift: { x: 0, y: 0, z: 0 },
    correctionFactor: 0.98 // Gradual drift correction
  })

  // Enhanced robot part discovery with detailed inspection
  const findRobotParts = (spline: Application): RobotParts => {
    const parts: RobotParts = {
      head: null,
      rightArm: null,
      leftArm: null,
      rightHand: null,
      leftHand: null,
      rightShoulder: null,
      leftShoulder: null,
      body: null
    }
    const foundParts: string[] = []

    console.log('🔍 ENHANCED ROBOT INSPECTION STARTED')

    // Get ALL objects for comprehensive analysis
    const allObjects = spline.getAllObjects?.() || []
    console.log(`📊 Total objects in scene: ${allObjects.length}`)

    // Log all named objects for debugging
    const namedObjects = allObjects.filter(obj => obj.name && obj.name.trim() !== '')
    console.log('📋 ALL NAMED OBJECTS IN SCENE:')
    namedObjects.forEach((obj, index) => {
      console.log(`  ${index + 1}. "${obj.name}" - ID: ${obj.id || 'none'}`)
    })

    // Head options (more specific search)
    const headNames = ['Head', 'head', 'Robot Head', 'Bot Head', 'Character Head', 'Top part']
    for (const name of headNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        parts.head = obj
        foundParts.push(`Head: ${name}`)
        console.log(`✅ HEAD found: ${name}`)
        break
      }
    }

    // Shoulder search (PRIORITY - shoulders control main arm movement)
    const rightShoulderNames = ['Right Shoulder', 'RightShoulder', 'Shoulder Right', 'R Shoulder', 'right shoulder']
    for (const name of rightShoulderNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        parts.rightShoulder = obj
        foundParts.push(`Right Shoulder: ${name}`)
        console.log(`✅ RIGHT SHOULDER found: ${name}`)
        break
      }
    }

    const leftShoulderNames = ['Left Shoulder', 'LeftShoulder', 'Shoulder Left', 'L Shoulder', 'left shoulder']
    for (const name of leftShoulderNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        parts.leftShoulder = obj
        foundParts.push(`Left Shoulder: ${name}`)
        console.log(`✅ LEFT SHOULDER found: ${name}`)
        break
      }
    }

    // UPDATED: Right arm search based on actual robot structure
    const rightArmNames = ['arm', 'Right Arm', 'RightArm', 'Arm Right', 'R Arm', 'Upper Arm Right', 'right arm']
    for (const name of rightArmNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        // Check if this is actually a right arm by checking nearby objects or position
        parts.rightArm = obj
        foundParts.push(`Right Arm: ${name}`)
        console.log(`✅ RIGHT ARM found: ${name}`)
        break
      }
    }

    // UPDATED: Left arm search - now includes 'arm' as potential left arm
    const leftArmNames = ['Left Arm', 'LeftArm', 'Arm Left', 'L Arm', 'Upper Arm Left', 'left arm']

    // If no right arm was found, use 'arm' for left arm
    if (!parts.rightArm) {
      const genericArm = spline.findObjectByName('arm')
      if (genericArm) {
        parts.leftArm = genericArm
        foundParts.push(`Left Arm: arm (generic)`)
        console.log(`✅ LEFT ARM found: arm (generic)`)
      }
    } else {
      // Look for a different 'arm' object if right arm already claimed one
      for (const name of leftArmNames) {
        const obj = spline.findObjectByName(name)
        if (obj && obj !== parts.rightArm) {
          parts.leftArm = obj
          foundParts.push(`Left Arm: ${name}`)
          console.log(`✅ LEFT ARM found: ${name}`)
          break
        }
      }
    }

    // UPDATED: Right hand/forearm search based on actual scene objects
    const rightHandNames = ['Hand', 'Hand Instance', 'forearm', 'elbow', 'Right Hand', 'RightHand', 'Hand Right', 'R Hand', 'Right Forearm']
    for (const name of rightHandNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        parts.rightHand = obj
        foundParts.push(`Right Hand/Forearm: ${name}`)
        console.log(`✅ RIGHT HAND/FOREARM found: ${name}`)
        break
      }
    }

    // UPDATED: Left hand search - prioritize 'Hand LEFT' then fallbacks
    const leftHandNames = ['Hand LEFT', 'Left Hand', 'LeftHand', 'Hand Left', 'L Hand', 'Left Forearm', 'LeftForearm']
    for (const name of leftHandNames) {
      const obj = spline.findObjectByName(name)
      if (obj && obj !== parts.rightHand) { // Don't use same object as right hand
        parts.leftHand = obj
        foundParts.push(`Left Hand/Forearm: ${name}`)
        console.log(`✅ LEFT HAND/FOREARM found: ${name}`)
        break
      }
    }

    // Fallback: If no dedicated left hand found, try to find a second 'forearm' or 'elbow'
    if (!parts.leftHand) {
      // Get all objects with these names
      const allObjects = spline.getAllObjects?.() || []
      const forearmObjects = allObjects.filter(obj => obj.name === 'forearm' || obj.name === 'elbow')

      // If we have multiple forearms/elbows, use the second one for left hand
      if (forearmObjects.length > 1 && parts.rightHand !== forearmObjects[1]) {
        parts.leftHand = forearmObjects[1]
        foundParts.push(`Left Hand/Forearm: ${forearmObjects[1].name} (second instance)`)
        console.log(`✅ LEFT HAND/FOREARM found: ${forearmObjects[1].name} (second instance)`)
      }
    }

    // Body (for reference)
    const bodyNames = ['Body', 'body', 'Torso', 'Chest', 'Robot', 'Character', 'Bot']
    for (const name of bodyNames) {
      const obj = spline.findObjectByName(name)
      if (obj) {
        parts.body = obj
        foundParts.push(`Body: ${name}`)
        console.log(`✅ BODY found: ${name}`)
        break
      }
    }

    // Final analysis
    console.log('🎯 WAVE CAPABILITY ANALYSIS:')
    const hasRightShoulder = !!parts.rightShoulder
    const hasRightArm = !!parts.rightArm
    const hasRightHand = !!parts.rightHand
    const hasLeftShoulder = !!parts.leftShoulder
    const hasLeftArm = !!parts.leftArm
    const hasLeftHand = !!parts.leftHand

    console.log(`Right side: Shoulder(${hasRightShoulder}) + Arm(${hasRightArm}) + Hand(${hasRightHand})`)
    console.log(`Left side: Shoulder(${hasLeftShoulder}) + Arm(${hasLeftArm}) + Hand(${hasLeftHand})`)

    if (hasRightShoulder && (hasRightArm || hasRightHand)) {
      console.log('🎉 RIGHT ARM wave capability: EXCELLENT')
    } else if (hasLeftShoulder && (hasLeftArm || hasLeftHand)) {
      console.log('🎉 LEFT ARM wave capability: EXCELLENT')
    } else if (hasRightArm || hasRightHand || hasLeftArm || hasLeftHand) {
      console.log('⚠️ PARTIAL wave capability: ARM ONLY')
    } else {
      console.log('❌ NO wave capability detected')
    }

    console.log('🔍 ENHANCED ROBOT INSPECTION COMPLETED')

    setRobotPartsFound(foundParts)
    return parts
  }

  // Enhanced natural wave animation
  // Helper function to assess wave quality based on available parts
  const getRobotPartQuality = (shoulder: any, arm: any, hand: any): string => {
    if (shoulder && (arm || hand)) {
      return 'EXCELLENT' // Full shoulder control
    } else if (arm && hand) {
      return 'GOOD' // Arm and hand coordination
    } else if (hand || arm) {
      return 'BASIC' // Single part movement
    } else {
      return 'NONE' // No suitable parts
    }
  }

  // RIGHT ARM CHAIN protection - prevent external interference
  const shouldSkipRightArmUpdate = (partName: string): boolean => {
    const RIGHT_ARM_CHAIN = ['arm', 'Hand', 'elbow', 'forearm', 'Hand Instance']
    return isWaving && RIGHT_ARM_CHAIN.includes(partName)
  }

  // RIGHT ARM MOVEMENT TRACKER - comprehensive position monitoring
  const trackRightArmMovement = (context: string = 'GENERAL') => {
    if (!robotPartsRef.current || !armTrackingRef.current.enabled) return

    const parts = robotPartsRef.current
    const currentPositions = {
      rightArm: parts.rightArm ? {
        position: { x: parts.rightArm.position?.x || 0, y: parts.rightArm.position?.y || 0, z: parts.rightArm.position?.z || 0 },
        rotation: { x: parts.rightArm.rotation?.x || 0, y: parts.rightArm.rotation?.y || 0, z: parts.rightArm.rotation?.z || 0 }
      } : null,
      rightHand: parts.rightHand ? {
        position: { x: parts.rightHand.position?.x || 0, y: parts.rightHand.position?.y || 0, z: parts.rightHand.position?.z || 0 },
        rotation: { x: parts.rightHand.rotation?.x || 0, y: parts.rightHand.rotation?.y || 0, z: parts.rightHand.rotation?.z || 0 }
      } : null,
      timestamp: Date.now(),
      context
    }

    // Check for position changes
    const lastPos = armTrackingRef.current.lastPositions
    if (lastPos) {
      let armMoved = false
      let handMoved = false

      if (currentPositions.rightArm && lastPos.rightArm) {
        const armRotDiff = Math.abs(currentPositions.rightArm.rotation.x - lastPos.rightArm.rotation.x) +
                          Math.abs(currentPositions.rightArm.rotation.y - lastPos.rightArm.rotation.y) +
                          Math.abs(currentPositions.rightArm.rotation.z - lastPos.rightArm.rotation.z)
        armMoved = armRotDiff > 0.001
      }

      if (currentPositions.rightHand && lastPos.rightHand) {
        const handRotDiff = Math.abs(currentPositions.rightHand.rotation.x - lastPos.rightHand.rotation.x) +
                           Math.abs(currentPositions.rightHand.rotation.y - lastPos.rightHand.rotation.y) +
                           Math.abs(currentPositions.rightHand.rotation.z - lastPos.rightHand.rotation.z)
        handMoved = handRotDiff > 0.001
      }

      // Log only when movement is detected
      if (armMoved || handMoved) {
        console.log(`🔄 RIGHT ARM MOVEMENT [${context}] @ ${new Date().toLocaleTimeString()}`)
        
        if (armMoved && currentPositions.rightArm) {
          console.log(`  🦾 ARM: rot(${currentPositions.rightArm.rotation.x.toFixed(3)}, ${currentPositions.rightArm.rotation.y.toFixed(3)}, ${currentPositions.rightArm.rotation.z.toFixed(3)})`)
        }
        
        if (handMoved && currentPositions.rightHand) {
          console.log(`  🤚 HAND: rot(${currentPositions.rightHand.rotation.x.toFixed(3)}, ${currentPositions.rightHand.rotation.y.toFixed(3)}, ${currentPositions.rightHand.rotation.z.toFixed(3)})`)
        }

        console.log(`  📊 Status: Wave=${isWaving}, Context=${context}`)
      }
    }

    armTrackingRef.current.lastPositions = currentPositions
  }

  // Enable/disable arm tracking
  const enableArmTracking = (enable: boolean, context: string = '') => {
    armTrackingRef.current.enabled = enable
    if (enable) {
      console.log(`🎯 RIGHT ARM TRACKING ENABLED ${context}`)
      trackRightArmMovement(`INIT-${context}`)
    } else {
      console.log(`⏹️ RIGHT ARM TRACKING DISABLED`)
    }
  }

  const performWaveAnimation = useCallback(() => {
    console.log('👋 NATURAL WAVE ANIMATION STARTING')

    const now = Date.now()
    if (isWaving) {
      console.log('❌ Already waving, skipping duplicate request')
      return
    }

    if (now - lastWaveTime.current < WAVE_COOLDOWN) {
      console.log(`❄️ Cooldown active - ${Math.round((WAVE_COOLDOWN - (now - lastWaveTime.current)) / 1000)}s remaining`)
      return
    }

    if (!robotPartsRef.current) {
      console.log('❌ No robot parts ref')
      return
    }

    // IMMEDIATE isolation - set flag before any async operations
    setIsWaving(true)
    lastWaveTime.current = now
    consecutiveWaveCount.current += 1
    console.log(`🔢 Wave count: ${consecutiveWaveCount.current}/${MAX_CONSECUTIVE_WAVES}`)
    console.log('🔒 RIGHT ARM ISOLATION ACTIVATED')
    
    // Calibrate base pose if this is first wave
    if (!basePoseRef.current.calibrated) {
      console.log('🎯 First wave - will calibrate base pose')
    }
    
    // Enable detailed arm tracking for wave animation
    enableArmTracking(true, 'WAVE-START')
    const parts = robotPartsRef.current
    const spline = splineRef.current

    if (!spline) {
      console.log('❌ Spline not ready')
      setIsWaving(false)
      return
    }

    // PRIORITY: Use right arm first (more natural for greeting)
    const rightShoulder = parts.rightShoulder
    const rightArm = parts.rightArm
    const rightHand = parts.rightHand

    const leftShoulder = parts.leftShoulder
    const leftArm = parts.leftArm
    const leftHand = parts.leftHand

    console.log('🎯 BILATERAL WAVE PARTS ANALYSIS:')
    console.log('RIGHT SIDE CAPABILITIES:', {
      shoulder: !!rightShoulder ? `✅ ${rightShoulder.name}` : '❌ None',
      arm: !!rightArm ? `✅ ${rightArm.name}` : '❌ None',
      hand: !!rightHand ? `✅ ${rightHand.name}` : '❌ None'
    })
    console.log('LEFT SIDE CAPABILITIES:', {
      shoulder: !!leftShoulder ? `✅ ${leftShoulder.name}` : '❌ None',
      arm: !!leftArm ? `✅ ${leftArm.name}` : '❌ None',
      hand: !!leftHand ? `✅ ${leftHand.name}` : '❌ None'
    })

    // Detailed bilateral analysis
    const rightQuality = getRobotPartQuality(rightShoulder, rightArm, rightHand)
    const leftQuality = getRobotPartQuality(leftShoulder, leftArm, leftHand)

    console.log('🏆 BILATERAL WAVE QUALITY ASSESSMENT:')
    console.log(`RIGHT SIDE: ${rightQuality} quality wave potential`)
    console.log(`LEFT SIDE: ${leftQuality} quality wave potential`)

    if (rightHand && leftHand) {
      console.log('🤚 BILATERAL HAND STATUS:')
      console.log(`RIGHT HAND (${rightHand.name}):`, {
        position: { x: rightHand.position?.x, y: rightHand.position?.y, z: rightHand.position?.z },
        rotation: { x: rightHand.rotation?.x, y: rightHand.rotation?.y, z: rightHand.rotation?.z }
      })
      console.log(`LEFT HAND (${leftHand.name}):`, {
        position: { x: leftHand.position?.x, y: leftHand.position?.y, z: leftHand.position?.z },
        rotation: { x: leftHand.rotation?.x, y: leftHand.rotation?.y, z: leftHand.rotation?.z }
      })
    }
    // Determine best wave configuration based on available parts
    let waveConfig = null

    // PRIORITY 1: Full shoulder + arm/hand setup (EXCELLENT quality)
    if (rightShoulder && (rightArm || rightHand)) {
      waveConfig = {
        shoulder: rightShoulder,
        arm: rightArm,
        hand: rightHand,
        side: 'RIGHT',
        quality: 'EXCELLENT'
      }
    } else if (leftShoulder && (leftArm || leftHand)) {
      waveConfig = {
        shoulder: leftShoulder,
        arm: leftArm,
        hand: leftHand,
        side: 'LEFT',
        quality: 'EXCELLENT'
      }
    }
    // PRIORITY 2: Arm and hand combo (GOOD quality)
    else if (rightArm && rightHand) {
      waveConfig = {
        shoulder: null,
        arm: rightArm,
        hand: rightHand,
        side: 'RIGHT',
        quality: 'GOOD'
      }
    } else if (leftArm && leftHand) {
      waveConfig = {
        shoulder: null,
        arm: leftArm,
        hand: leftHand,
        side: 'LEFT',
        quality: 'GOOD'
      }
    }
    // PRIORITY 3: Single part (BASIC quality)
    else if (rightHand) {
      waveConfig = {
        shoulder: null,
        arm: rightArm, // might be null
        hand: rightHand,
        side: 'RIGHT',
        quality: 'BASIC'
      }
    } else if (leftHand) {
      waveConfig = {
        shoulder: null,
        arm: leftArm, // might be null
        hand: leftHand,
        side: 'LEFT',
        quality: 'BASIC'
      }
    } else if (rightArm) {
      waveConfig = {
        shoulder: null,
        arm: rightArm,
        hand: null,
        side: 'RIGHT',
        quality: 'BASIC'
      }
    } else if (leftArm) {
      waveConfig = {
        shoulder: null,
        arm: leftArm,
        hand: null,
        side: 'LEFT',
        quality: 'BASIC'
      }
    }

    if (!waveConfig) {
      console.log('❌ No suitable wave parts found')
      setIsWaving(false)
      return
    }

    console.log(`✅ Using ${waveConfig.side} arm configuration (${waveConfig.quality} quality)`)
    performNaturalWave(waveConfig).catch((error) => {
      console.error('Wave animation error:', error)
      setIsWaving(false)
    })

  }, [isWaving])

  // NATURAL HUMAN-LIKE WAVE ANIMATION
  // ─────────────────────────────────────────────
  // Types
  // ─────────────────────────────────────────────
  type WaveSide = "LEFT" | "RIGHT"
  type WaveQuality = "LOW" | "MEDIUM" | "HIGH"

  interface SplineBone {
    rotation: {
      x: number
      y: number
      z: number
    }
  }

  interface WaveConfig {
    side: WaveSide
    quality: WaveQuality
    shoulder?: SplineBone | null
    arm?: SplineBone | null
    hand?: SplineBone | null
  }

  interface RotationState {
    x: number
    y: number
    z: number
  }

  // ─────────────────────────────────────────────
  // ABSOLUTE BIOMECHANICAL CONSTANTS
  // (human-inspired wave targets)
  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  // HYBRID BIOMECHANICS: RELATIVE, TUNED DELTAS
  // ─────────────────────────────────────────────
  const BIOMECHANICS = {
    // Arm motion: gentle relative deltas from rest
    TARGET_SHOULDER_LIFT: 0.5,    // ~30° absolute lift
    ARM_LIFT_X_DELTA: -0.15,      // ~8° more lift (Reduced for subtlety)
    ARM_FORWARD_Y_DELTA: 0.05,    // Reduced forward tilt
    ARM_OUTWARD_Z_DELTA: 0.05,    // Reduced outward flare

    // Phase durations
    PHASE_1_DURATION: 0.6,
    PHASE_2_SEGMENT: 0.6,
    PHASE_3_DURATION: 0.6,

    // Wrist oscillation – smaller, more subtle (Reduced by ~50%)
    WRIST_OUT_Y_DELTA: 0.12,
    WRIST_OUT_Z_DELTA: 0.10,
    WRIST_IN_Y_DELTA: 0.09,
    WRIST_IN_Z_DELTA: 0.08,
    WRIST_DAMPED_Y_DELTA: 0.09,
    WRIST_DAMPED_Z_DELTA: 0.09,

    // Rest precision
    REST_TOLERANCE: 0.001
  }

  const performNaturalWave = useCallback(
    (config: WaveConfig) => {
      console.log(`👋 Starting CLEAN ${config.side} wave (${config.quality} quality)`)
      const isLeftSide = config.side === "LEFT"
      const sideMultiplier = isLeftSide ? -1 : 1

      // ─────────────────────────────────────────
      // 1. CAPTURE BASE POSE FOR RESTORATION
      // ─────────────────────────────────────────
      const capturePartState = (part: any): RotationState | null => {
        if (!part || !part.rotation) return null
        return {
          x: Number(part.rotation.x.toPrecision(8)),
          y: Number(part.rotation.y.toPrecision(8)),
          z: Number(part.rotation.z.toPrecision(8))
        }
      }

      const basePose = {
        shoulder: config.shoulder ? capturePartState(config.shoulder) : null,
        arm: config.arm ? capturePartState(config.arm) : null,
        hand: config.hand ? capturePartState(config.hand) : null
      }

      console.log("🔒 Captured base pose for restoration:", basePose)
      
      // Track initial arm state before wave starts
      trackRightArmMovement('WAVE-PRE-ANIMATION')

      // ─────────────────────────────────────────
      // 2. CREATE CLEAN 3-PHASE TIMELINE
      // ─────────────────────────────────────────
      return new Promise<void>((resolve) => {
        const cleanWave = gsap.timeline({
          onComplete: () => {
            // Restore ALL parts to exact base pose
            if (config.shoulder && basePose.shoulder) {
              gsap.to(config.shoulder.rotation, {
                x: basePose.shoulder.x,
                y: basePose.shoulder.y,
                z: basePose.shoulder.z,
                duration: 0.25,
                ease: "power2.inOut"
              })
            }
            if (config.arm && basePose.arm) {
              gsap.to(config.arm.rotation, {
                x: basePose.arm.x,
                y: basePose.arm.y,
                z: basePose.arm.z,
                duration: 0.25,
                ease: "power2.inOut"
              })
            }
            if (config.hand && basePose.hand) {
              gsap.to(config.hand.rotation, {
                x: basePose.hand.x,
                y: basePose.hand.y,
                z: basePose.hand.z,
                duration: 0.25,
                ease: "power2.inOut",
                onComplete: () => {
                  trackRightArmMovement('WAVE-COMPLETE')
                  enableArmTracking(false)
                  setIsWaving(false)
                  console.log("✅ Wave complete - isolation ended")
                  resolve()
                }
              })
            } else {
              trackRightArmMovement('WAVE-COMPLETE')
              enableArmTracking(false)
              setIsWaving(false)
              console.log("✅ Wave complete - isolation ended")
              resolve()
            }
          }
        })

        // ─────────────────────────────────────────
        // PHASE 1: Move to "wave ready" pose (0 → 0.35s)
        // ─────────────────────────────────────────
        if (config.shoulder && basePose.shoulder) {
          cleanWave.to(config.shoulder.rotation, {
            // Lift arm sideways and slightly forward
            z: basePose.shoulder.z + sideMultiplier * 0.6, // ~35° lift
            y: basePose.shoulder.y + sideMultiplier * 0.2, // slight forward
            duration: 0.35,
            ease: "power2.out",
            onStart: () => trackRightArmMovement('PHASE-1-START'),
            onUpdate: () => trackRightArmMovement('PHASE-1-LIFT'),
            onComplete: () => trackRightArmMovement('PHASE-1-COMPLETE')
          })
        }

        if (config.arm && basePose.arm) {
          cleanWave.to(config.arm.rotation, {
            // Bend elbow to bring hand to wave level
            z: basePose.arm.z + sideMultiplier * 0.9, // ~50° bend
            duration: 0.35,
            ease: "power2.out",
            onUpdate: () => trackRightArmMovement('PHASE-1-ARM-BEND')
          }, "<") // Same time as shoulder
        }

        // ─────────────────────────────────────────
        // PHASE 2: Simple wave motion (0.35s → 1.45s)
        // ─────────────────────────────────────────
        const wavePart = config.hand || config.arm
        const waveBase = config.hand ? basePose.hand : basePose.arm
        
        if (wavePart && waveBase) {
          // Enhanced natural wave motion with multi-axis hand movement
          const waveTimeline = gsap.timeline({
            onStart: () => trackRightArmMovement('PHASE-2-WAVE-START'),
            onComplete: () => trackRightArmMovement('PHASE-2-WAVE-COMPLETE')
          })
          
          // Create more natural wave with varying intensities and multi-axis motion
          for (let i = 0; i < 3; i++) {
            const isFirstWave = i === 0
            const isLastWave = i === 2
            const intensity = isFirstWave ? 0.4 : (isLastWave ? 0.25 : 0.35) // Diminishing intensity
            const duration = isFirstWave ? 0.15 : (isLastWave ? 0.22 : 0.18) // Varying speed
            
            // Primary Y-axis wave motion (side-to-side)
            waveTimeline.to(wavePart.rotation, {
              y: waveBase.y + sideMultiplier * intensity, // Dynamic intensity
              duration: duration,
              ease: "power2.out",
              onUpdate: () => trackRightArmMovement('PHASE-2-WAVING')
            }, i === 0 ? "+=0.05" : "+=0.05")
            
            // Natural wrist flexion (slight up/down motion)
            waveTimeline.to(wavePart.rotation, {
              x: waveBase.x + (isFirstWave ? 0.1 : 0.05), // Slight upward wrist flex
              duration: duration * 0.7, // Faster wrist movement
              ease: "sine.inOut"
            }, "<")
            
            // Return stroke with palm rotation for natural gesture
            waveTimeline.to(wavePart.rotation, {
              y: waveBase.y - sideMultiplier * intensity * 0.8, // Slightly less return
              x: waveBase.x - (isFirstWave ? 0.08 : 0.03), // Slight downward flex
              z: waveBase.z + sideMultiplier * 0.05, // Subtle palm rotation
              duration: duration,
              ease: "power2.in"
            }, "+=0.02")
          }
          
          // Final return to neutral with gentle settling
          waveTimeline.to(wavePart.rotation, {
            y: waveBase.y,
            x: waveBase.x,
            z: waveBase.z,
            duration: 0.25,
            ease: "power2.inOut"
          }, "+=0.1")
          
          cleanWave.add(waveTimeline, "+=0.05")

          // Enhanced forearm assist for coordinated natural motion
          if (config.arm && config.hand && basePose.arm) {
            const forearmTimeline = gsap.timeline()
            
            // Coordinated forearm movement that follows hand gestures
            for (let i = 0; i < 3; i++) {
              const isFirstWave = i === 0
              const armIntensity = isFirstWave ? 0.15 : 0.1 // Subtle forearm support
              const duration = isFirstWave ? 0.15 : (i === 2 ? 0.22 : 0.18)
              
              // Supportive elbow flex during wave out
              forearmTimeline.to(config.arm.rotation, {
                z: basePose.arm.z + sideMultiplier * armIntensity,
                x: basePose.arm.x + 0.05, // Slight lift for natural gesture
                duration: duration,
                ease: "power2.out",
                onUpdate: () => trackRightArmMovement('PHASE-2-ARM-ASSIST')
              }, i === 0 ? "+=0.05" : "+=0.05")
              
              // Return with slight overextension for realism
              forearmTimeline.to(config.arm.rotation, {
                z: basePose.arm.z - sideMultiplier * armIntensity * 0.5,
                x: basePose.arm.x,
                duration: duration,
                ease: "power2.in"
              }, "+=0.02")
            }
            
            // Final settle to base pose
            forearmTimeline.to(config.arm.rotation, {
              z: basePose.arm.z,
              x: basePose.arm.x,
              duration: 0.25,
              ease: "power2.inOut"
            }, "+=0.1")
            
            cleanWave.add(forearmTimeline, "+=0.05") // Sync with hand wave
          }
        }

        // ─────────────────────────────────────────
        // PHASE 3: Return handled by onComplete
        // ─────────────────────────────────────────

        cleanWave.play()
        console.log(`👋 CLEAN wave timeline started - 3 simple phases`)
      })
    },
    [setIsWaving]
  )

  // Handle Spline load with robot inspection
  const handleLoad = (spline: Application) => {
    splineRef.current = spline
    if (onLoad) onLoad(spline)
    spline.setZoom(1)

    console.log('🤖 ROBOT INSPECTION STARTED 🤖')
    console.log('Available objects:', spline.getAllObjects?.())

    // Find and store robot parts
    const parts = findRobotParts(spline)
    robotPartsRef.current = parts

    console.log('🔍 ROBOT PARTS ANALYSIS:')
    console.log('Head found:', !!parts.head)
    console.log('Right Arm found:', !!parts.rightArm)
    console.log('Left Arm found:', !!parts.leftArm)
    console.log('Right Hand found:', !!parts.rightHand)
    console.log('Left Hand found:', !!parts.leftHand)
    console.log('Body found:', !!parts.body)

    // Log all available objects for debugging
    const allObjects = spline.getAllObjects?.() || []
    const namedObjects = allObjects.map(obj => obj.name || 'unnamed').filter(name => name !== 'unnamed')
    console.log('ALL SCENE OBJECTS:', namedObjects)

    // Look for objects that might be arms/hands
    const possibleArmObjects = namedObjects.filter(name =>
      name.toLowerCase().includes('arm') ||
      name.toLowerCase().includes('hand') ||
      name.toLowerCase().includes('limb') ||
      name.toLowerCase().includes('appendage') ||
      name.toLowerCase().includes('wing') ||
      name.toLowerCase().includes('tentacle') ||
      name.toLowerCase().includes('finger')
    )

    if (possibleArmObjects.length > 0) {
      console.log('🔍 POSSIBLE ARM/HAND OBJECTS FOUND:', possibleArmObjects)
    } else {
      console.log('🔍 NO ARM-LIKE OBJECT NAMES DETECTED')
      console.log('📋 First 20 object names:', namedObjects.slice(0, 20))
    }

    console.log('🤖 ROBOT INSPECTION COMPLETED 🤖')
  }

  // Watch for person detection changes to trigger wave
  useEffect(() => {
    if (personDetected && !previousPersonDetected.current && !isWaving) {
      // Person just detected - trigger wave with double-check for isolation
      console.log('👋 Person detected - starting greeting wave!')
      performWaveAnimation()
    }
    previousPersonDetected.current = personDetected
  }, [personDetected, isPersonNear, performWaveAnimation, isWaving])

  // Smooth animation loop for robot head movements
  useEffect(() => {
    if (!splineRef.current) return

    const robotHead = robotPartsRef.current?.head

    // PAUSE head movement during wave animation to prevent conflicts
    if (isWaving) {
      console.log('⏸️ Pausing head movement during wave animation')
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (idleAnimationRef.current) {
        cancelAnimationFrame(idleAnimationRef.current)
        idleAnimationRef.current = undefined
      }
      return
    }

    // Update target rotation based on person detection
    if (personDetected && !isWaving) {
      // Set target based on face position (reduced intensity for head-only movement)
      targetRotationRef.current = {
        x: faceY * 0.2,
        y: faceX * 0.3
      }

      // Stop idle animation when person detected
      if (idleAnimationRef.current) {
        cancelAnimationFrame(idleAnimationRef.current)
        idleAnimationRef.current = undefined
      }
      
      // Enable arm tracking during person interaction
      if (!armTrackingRef.current.enabled) {
        enableArmTracking(true, 'PERSON-TRACKING')
      }
    } else if (!isWaving) {
      // Start idle animation when no person detected (and not waving)
      if (!idleAnimationRef.current) {
        const startIdleAnimation = () => {
          const time = Date.now() / 3000

          // Gentle idle "looking around" motion
          targetRotationRef.current = {
            x: Math.sin(time * 0.7) * 0.1,
            y: Math.sin(time * 0.5) * 0.2
          }

          idleAnimationRef.current = requestAnimationFrame(startIdleAnimation)
        }
        startIdleAnimation()
      }
      
      // Enable arm tracking during idle (but at lower frequency)
      if (!armTrackingRef.current.enabled) {
        enableArmTracking(true, 'IDLE-MODE')
      }
    }

    // Smooth interpolation animation loop
    const smoothUpdate = () => {
      if (!isWaving) { // Don't interfere with wave animation
        try {
          // Lerp (linear interpolation) for smooth movement
          const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor
          const smoothFactor = personDetected ? 0.15 : 0.05

          currentRotationRef.current.x = lerp(currentRotationRef.current.x, targetRotationRef.current.x, smoothFactor)
          currentRotationRef.current.y = lerp(currentRotationRef.current.y, targetRotationRef.current.y, smoothFactor)

          // Apply rotation ONLY to robot head
          if (robotHead) {
            if (isPersonNear) {
              // Mimic mode - more responsive head movement
              robotHead.rotation.y = faceX * 0.6
              robotHead.rotation.x = faceY * 0.4
              // console.log('Head mimic:', faceX, faceY) // Debug: uncomment if needed
            } else {
              // Gentle tracking or idle head movement
              robotHead.rotation.y = currentRotationRef.current.y
              robotHead.rotation.x = currentRotationRef.current.x
            }
          } else {
            console.log('⚠️ Robot head not found for movement!')
          }
        } catch (error) {
          console.error('Error in head animation loop:', error)
        }
      }

      animationFrameRef.current = requestAnimationFrame(smoothUpdate)
    }

    smoothUpdate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (idleAnimationRef.current) {
        cancelAnimationFrame(idleAnimationRef.current)
      }
    }
  }, [faceX, faceY, isPersonNear, personDetected, isWaving])

  return (
    <>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-center">
              <span className="loader"></span>
              <p className="text-white mt-4">Loading 3D Robot...</p>
            </div>
          </div>
        }
      >
        <Spline
          scene={scene}
          className={className}
          onLoad={handleLoad}
          style={{ pointerEvents: 'none' }}
        />
      </Suspense>

      {/* Robot Parts Debug Info */}
      {robotPartsFound.length > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 z-40">
          <div className="text-center">
            <h3 className="font-semibold mb-1">🤖 Robot Parts Found</h3>
            <div className="text-xs text-green-300 space-y-1">
              {robotPartsFound.map((part, index) => (
                <div key={index}>{part}</div>
              ))}
            </div>
            {isWaving && (
              <div className="mt-2 text-yellow-300 font-semibold animate-pulse">
                👋 Waving...
              </div>
            )}
            <div className="mt-2 space-x-2 flex flex-wrap">
              <button
                onClick={() => !isWaving && performWaveAnimation()}
                disabled={isWaving}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white text-xs rounded transition-colors mb-1"
              >
                {isWaving ? 'Waving...' : 'Test Natural Wave'}
              </button>
              <button
                onClick={() => enableArmTracking(!armTrackingRef.current.enabled, 'MANUAL-TOGGLE')}
                className={`px-3 py-1 text-white text-xs rounded transition-colors mb-1 ${
                  armTrackingRef.current.enabled 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gray-500 hover:bg-gray-600'
                }`}
              >
                {armTrackingRef.current.enabled ? '📊 Tracking ON' : '📊 Tracking OFF'}
              </button>
              <button
                onClick={() => trackRightArmMovement('MANUAL-SNAPSHOT')}
                className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors mb-1"
              >
                📸 Snapshot
              </button>
              <button
                onClick={() => {
                  const parts = robotPartsRef.current
                  console.log('🔍 MANUAL DEBUG - Current robot parts:')
                  console.log('Right arm:', parts?.rightArm ? `✅ ${parts.rightArm.name}` : '❌ None')
                  console.log('Left arm:', parts?.leftArm ? `✅ ${parts.leftArm.name}` : '❌ None')
                  console.log('Right hand:', parts?.rightHand ? `✅ ${parts.rightHand.name}` : '❌ None')
                  console.log('Left hand:', parts?.leftHand ? `✅ ${parts.leftHand.name}` : '❌ None')
                  console.log('Base pose calibrated:', basePoseRef.current.calibrated)
                  console.log('Wave count:', consecutiveWaveCount.current)
                  console.log('Position drift:', positionDriftRef.current)
                }}
                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors mb-1"
              >
                Debug Parts
              </button>
              <button
                onClick={() => {
                  // Reset calibration and wave counters
                  basePoseRef.current = {
                    rightArm: null,
                    rightHand: null,
                    leftHand: null,
                    rightShoulder: null,
                    calibrated: false
                  }
                  consecutiveWaveCount.current = 0
                  positionDriftRef.current = {
                    rightArmDrift: { x: 0, y: 0, z: 0 },
                    rightHandDrift: { x: 0, y: 0, z: 0 },
                    correctionFactor: 0.98
                  }
                  console.log('⚙️ Pose calibration reset - next wave will recalibrate base pose')
                  console.log('🔄 Wave counter reset to 0')
                  console.log('🔄 Position drift correction reset')
                }}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors mb-1"
              >
                Reset Calibration
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              🎯 Wave capability: {robotPartsRef.current?.rightShoulder || robotPartsRef.current?.leftShoulder ? 'EXCELLENT' : (robotPartsRef.current?.rightHand || robotPartsRef.current?.leftHand || robotPartsRef.current?.rightArm || robotPartsRef.current?.leftArm) ? 'DETECTED' : 'NONE'}
              <br />
              📐 Pose calibrated: {basePoseRef.current.calibrated ? '✅' : '❌'}
              <br />
              🔢 Wave count: {consecutiveWaveCount.current}/{MAX_CONSECUTIVE_WAVES}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
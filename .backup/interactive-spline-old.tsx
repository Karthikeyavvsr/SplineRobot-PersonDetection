'use client'

import { Suspense, lazy, useEffect, useRef } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface InteractiveSplineProps {
  scene: string
  className?: string
  faceX?: number // -1 (left) to 1 (right)
  faceY?: number // -1 (top) to 1 (bottom)
  onLoad?: (spline: Application) => void
  isPersonNear?: boolean // true when person is close (for face mimicking)
  personDetected?: boolean // true when any person is detected (for arm wave)
}

export function InteractiveSpline({
  scene,
  className,
  faceX = 0,
  faceY = 0,
  onLoad,
  isPersonNear = false,
  personDetected = false
}: InteractiveSplineProps) {
  const splineRef = useRef<Application | null>(null)
  const animationFrameRef = useRef<number>()
  const idleAnimationRef = useRef<number>()

  // Smooth interpolation for camera/robot rotation
  const currentRotationRef = useRef({ x: 0, y: 0 })
  const targetRotationRef = useRef({ x: 0, y: 0 })

  // Handle Spline load
  const handleLoad = (spline: Application) => {
    splineRef.current = spline
    if (onLoad) onLoad(spline)

    // Disable mouse interaction so only face tracking controls the scene
    spline.setZoom(1)

    console.log('Spline scene loaded!')
    console.log('Available objects:', spline.getAllObjects?.())
  }

  // Smooth animation loop for robot movements
  useEffect(() => {
    if (!splineRef.current) return

    // Camera removed - only moving robot head now
    const robotHead = splineRef.current.findObjectByName('Head') || splineRef.current.findObjectByName('Top part') || splineRef.current.findObjectByName('Bot Head') ||
                  splineRef.current.findObjectByName('Head') ||
                  splineRef.current.findObjectByName('Top part')

    // Update target rotation based on person detection
    if (personDetected) {
      // Set target based on face position
      targetRotationRef.current = {
        x: faceY * 0.3,
        y: faceX * 0.5
      }

      // Stop idle animation when person detected
      if (idleAnimationRef.current) {
        cancelAnimationFrame(idleAnimationRef.current)
        idleAnimationRef.current = undefined
      }
    } else {
      // Start idle animation when no person detected
      if (!idleAnimationRef.current) {
        const startIdleAnimation = () => {
          const time = Date.now() / 3000 // Slow idle motion

          // Gentle idle "looking around" motion
          targetRotationRef.current = {
            x: Math.sin(time * 0.7) * 0.15,
            y: Math.sin(time * 0.5) * 0.3
          }

          idleAnimationRef.current = requestAnimationFrame(startIdleAnimation)
        }
        startIdleAnimation()
      }
    }

    // Smooth interpolation animation loop
    const smoothUpdate = () => {
      try {
        // Lerp (linear interpolation) for smooth movement
        const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor
        const smoothFactor = personDetected ? 0.15 : 0.05 // Faster when tracking, slower when idle

        currentRotationRef.current.x = lerp(currentRotationRef.current.x, targetRotationRef.current.x, smoothFactor)
        currentRotationRef.current.y = lerp(currentRotationRef.current.y, targetRotationRef.current.y, smoothFactor)

        // Apply smooth rotation to camera
        if (camera) {
          camera.rotation.x = currentRotationRef.current.x
          camera.rotation.y = currentRotationRef.current.y
        }

        // Apply smooth rotation to robot head
        if (robot) {
          if (isPersonNear) {
            // Mimic mode - more responsive
            robot.rotation.y = faceX * 1.2
            robot.rotation.x = faceY * 0.8
          } else {
            // Gentle tracking or idle
            robot.rotation.y = currentRotationRef.current.y * 1.2
            robot.rotation.x = currentRotationRef.current.x * 0.8
          }
        }

      } catch (error) {
        console.error('Error in animation loop:', error)
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
  }, [faceX, faceY, isPersonNear, personDetected])

  return (
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
  )
}

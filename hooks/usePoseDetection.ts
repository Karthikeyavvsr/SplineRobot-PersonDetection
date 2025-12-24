'use client'

import { useEffect, useRef, useState } from 'react'
import * as bodyPix from '@tensorflow-models/body-pix'
import '@tensorflow/tfjs-backend-webgl'

export interface BodyPosition {
  x: number // Normalized position -1 (left) to 1 (right)
  y: number // Normalized position -1 (top) to 1 (bottom)
  confidence: number
}

export function usePoseDetection() {
  const [model, setModel] = useState<bodyPix.BodyPix | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bodyPosition, setBodyPosition] = useState<BodyPosition | null>(null)
  const lastDetectionTime = useRef<number>(0)
  const detectionInterval = 100 // Detect every 100ms (10 FPS for performance)

  // Initialize TensorFlow.js BodyPix model
  useEffect(() => {
    const initializeModel = async () => {
      try {
        console.log('Initializing TensorFlow.js BodyPix model...')

        const net = await bodyPix.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        })

        console.log('BodyPix model loaded successfully!')
        setModel(net)
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize BodyPix model:', err)
        setError(`Failed to load: ${err}`)
        setIsLoading(false)
      }
    }

    initializeModel()

    return () => {
      model?.dispose()
    }
  }, [])

  const detectPose = async (video: HTMLVideoElement) => {
    if (!model || !video) {
      return
    }

    const now = Date.now()
    if (now - lastDetectionTime.current < detectionInterval) {
      return
    }
    lastDetectionTime.current = now

    try {
      // Segment the person from the video
      const segmentation = await model.segmentPerson(video, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.5
      })

      if (segmentation && segmentation.allPoses && segmentation.allPoses.length > 0) {
        const pose = segmentation.allPoses[0]
        const keypoints = pose.keypoints

        // Find body center using shoulders, hips, and nose
        const leftShoulder = keypoints.find(kp => kp.part === 'leftShoulder')
        const rightShoulder = keypoints.find(kp => kp.part === 'rightShoulder')
        const leftHip = keypoints.find(kp => kp.part === 'leftHip')
        const rightHip = keypoints.find(kp => kp.part === 'rightHip')
        const nose = keypoints.find(kp => kp.part === 'nose')

        // Calculate body center from available keypoints
        const validPoints = [leftShoulder, rightShoulder, leftHip, rightHip, nose].filter(
          kp => kp && kp.score > 0.3
        )

        if (validPoints.length > 0) {
          const avgX = validPoints.reduce((sum, kp) => sum + kp!.position.x, 0) / validPoints.length
          const avgY = validPoints.reduce((sum, kp) => sum + kp!.position.y, 0) / validPoints.length
          const avgConfidence = validPoints.reduce((sum, kp) => sum + kp!.score, 0) / validPoints.length

          // Normalize coordinates to -1 to 1 range
          const normalizedX = (avgX / video.videoWidth) * 2 - 1
          const normalizedY = (avgY / video.videoHeight) * 2 - 1

          const position = {
            x: -normalizedX, // Invert X to fix mirror effect
            y: normalizedY,
            confidence: avgConfidence
          }

          setBodyPosition(prev => {
            // Only update if values changed significantly (reduce flickering)
            if (!prev || Math.abs(prev.x - position.x) > 0.01 || Math.abs(prev.y - position.y) > 0.01) {
              return position
            }
            return prev
          })
        } else {
          setBodyPosition(prev => prev !== null ? null : prev)
        }
      } else {
        // No person detected
        setBodyPosition(prev => prev !== null ? null : prev)
      }
    } catch (err) {
      console.error('Detection error:', err)
    }
  }

  return {
    detectPose,
    bodyPosition,
    isLoading,
    error,
    isReady: !!model
  }
}

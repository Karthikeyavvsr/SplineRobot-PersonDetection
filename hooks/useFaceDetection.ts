'use client'

import { useEffect, useRef, useState } from 'react'
import { FaceDetector, FilesetResolver, Detection } from '@mediapipe/tasks-vision'

export interface FacePosition {
  x: number // Normalized position -1 (left) to 1 (right)
  y: number // Normalized position -1 (top) to 1 (bottom)
  width: number
  height: number
  confidence: number
}

export function useFaceDetection() {
  const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facePosition, setFacePosition] = useState<FacePosition | null>(null)
  const lastDetectionTime = useRef<number>(0)
  const detectionInterval = 100 // Detect every 100ms (10 FPS for performance)

  // Initialize MediaPipe Face Detector
  useEffect(() => {
    const initializeFaceDetector = async () => {
      try {
        console.log('Initializing MediaPipe Face Detector...')

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        console.log('Vision tasks loaded')

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5
        })
        console.log('Face detector created successfully!')

        setFaceDetector(detector)
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize face detector:', err)
        setError(`Failed to load: ${err}`)
        setIsLoading(false)
      }
    }

    initializeFaceDetector()

    return () => {
      faceDetector?.close()
    }
  }, [])

  const detectFace = (video: HTMLVideoElement) => {
    if (!faceDetector || !video) {
      if (!faceDetector) console.log('Detector not ready')
      return
    }

    const now = Date.now()
    if (now - lastDetectionTime.current < detectionInterval) {
      return
    }
    lastDetectionTime.current = now

    try {
      const detections = faceDetector.detectForVideo(video, now)

      if (detections.detections && detections.detections.length > 0) {
        const detection = detections.detections[0] // Use first detected face
        const boundingBox = detection.boundingBox

        if (boundingBox) {
          // Normalize coordinates to -1 to 1 range
          // Center is 0, left/top is -1, right/bottom is 1
          const centerX = boundingBox.originX + boundingBox.width / 2
          const centerY = boundingBox.originY + boundingBox.height / 2

          const normalizedX = (centerX / video.videoWidth) * 2 - 1
          const normalizedY = (centerY / video.videoHeight) * 2 - 1

          const position = {
            x: -normalizedX, // Invert X to fix mirror effect
            y: normalizedY,
            width: boundingBox.width / video.videoWidth,
            height: boundingBox.height / video.videoHeight,
            confidence: detection.categories?.[0]?.score || 0
          }

          setFacePosition(position)
        }
      } else {
        // No face detected
        setFacePosition(null)
      }
    } catch (err) {
      console.error('Detection error:', err)
    }
  }

  return {
    detectFace,
    facePosition,
    isLoading,
    error,
    isReady: !!faceDetector
  }
}

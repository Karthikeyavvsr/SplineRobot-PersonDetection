'use client'

import { useRef, useEffect, useState } from 'react'
import Webcam from 'react-webcam'
import { usePoseDetection, BodyPosition } from '@/hooks/usePoseDetection'
import { useFaceDetection, FacePosition } from '@/hooks/useFaceDetection'

interface CombinedTrackerProps {
  onPositionDetected: (position: { x: number; y: number; isPersonNear: boolean; personDetected: boolean }) => void
  showWebcam?: boolean
}

export function CombinedTracker({ onPositionDetected, showWebcam = false }: CombinedTrackerProps) {
  const webcamRef = useRef<Webcam>(null)
  const animationFrameRef = useRef<number>()

  // Body detection for distant tracking
  const {
    detectPose,
    bodyPosition,
    isLoading: bodyLoading,
    error: bodyError,
    isReady: bodyReady
  } = usePoseDetection()

  // Face detection for close-up mimicking
  const {
    detectFace,
    facePosition,
    isLoading: faceLoading,
    error: faceError,
    isReady: faceReady
  } = useFaceDetection()

  const [currentPosition, setCurrentPosition] = useState<{
    x: number
    y: number
    isPersonNear: boolean
    personDetected: boolean
  }>({ x: 0, y: 0, isPersonNear: false, personDetected: false })

  // Determine if person is "near" based on face size
  const isPersonNear = (facePos: FacePosition | null): boolean => {
    if (!facePos) return false
    // If face takes up more than 15% of the screen width, consider them "near"
    return facePos.width > 0.15
  }

  // Combined detection logic with memoization to prevent infinite loops
  useEffect(() => {
    let isFaceNear = false
    let position = { x: 0, y: 0 }
    let personDetected = false

    if (facePosition && facePosition.confidence > 0.6) {
      // Face detected - use face position
      isFaceNear = isPersonNear(facePosition)
      position = { x: facePosition.x, y: -facePosition.y } // Invert Y for correct direction
      personDetected = true
    } else if (bodyPosition && bodyPosition.confidence > 0.3) {
      // No face but body detected - use body position
      position = { x: bodyPosition.x, y: bodyPosition.y }
      personDetected = true
      isFaceNear = false
    } else {
      // No detection
      personDetected = false
    }

    // Only update if values actually changed (prevent infinite loops)
    setCurrentPosition(prev => {
      const hasChanged =
        prev.x !== position.x ||
        prev.y !== position.y ||
        prev.isPersonNear !== isFaceNear ||
        prev.personDetected !== personDetected

      if (hasChanged) {
        const newPosition = {
          x: position.x,
          y: position.y,
          isPersonNear: isFaceNear,
          personDetected
        }
        onPositionDetected(newPosition)
        return newPosition
      }
      return prev
    })
  }, [facePosition, bodyPosition])

  // Detection loop
  useEffect(() => {
    if (!bodyReady && !faceReady) return

    const detect = () => {
      if (webcamRef.current?.video) {
        const video = webcamRef.current.video
        if (video.readyState === 4) {
          // Run both detections
          if (faceReady) detectFace(video)
          if (bodyReady) detectPose(video)
        }
      }
      animationFrameRef.current = requestAnimationFrame(detect)
    }

    detect()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [bodyReady, faceReady, detectFace, detectPose])

  const isLoading = bodyLoading || faceLoading
  const error = bodyError || faceError
  const isReady = bodyReady || faceReady

  return (
    <div className="fixed top-4 right-4 z-50">
      {isLoading && (
        <div className="bg-blue-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Loading AI models...
        </div>
      )}

      {error && (
        <div className="bg-red-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Error: {error}
        </div>
      )}

      {isReady && !currentPosition.personDetected && (
        <div className="bg-yellow-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Ready - Looking for person...
        </div>
      )}

      {currentPosition.personDetected && !currentPosition.isPersonNear && (
        <div className="bg-green-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Person detected - Tracking
        </div>
      )}

      {currentPosition.isPersonNear && (
        <div className="bg-purple-500/80 text-white px-4 py-2 rounded-lg mb-2 animate-pulse">
          Close up - Mimicking mode!
        </div>
      )}

      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: 'user'
        }}
        className={`rounded-lg border-2 ${
          currentPosition.isPersonNear
            ? 'border-purple-500'
            : currentPosition.personDetected
            ? 'border-green-500'
            : 'border-gray-500'
        } ${showWebcam ? 'opacity-100' : 'opacity-0 w-0 h-0'}`}
        style={{ maxWidth: '200px' }}
        onUserMedia={() => console.log('Webcam started!')}
        onUserMediaError={(err) => console.error('Webcam error:', err)}
      />

      {showWebcam && currentPosition.personDetected && (
        <div className="mt-2 bg-black/80 text-white px-3 py-2 rounded-lg text-xs font-mono">
          <div>X: {currentPosition.x.toFixed(2)}</div>
          <div>Y: {currentPosition.y.toFixed(2)}</div>
          <div>Mode: {currentPosition.isPersonNear ? 'MIMIC' : 'TRACK'}</div>
          {facePosition && <div>Face: {(facePosition.width * 100).toFixed(0)}% screen</div>}
        </div>
      )}

      {showWebcam && isReady && (
        <div className="mt-2 bg-black/80 text-white px-3 py-2 rounded-lg text-xs">
          <div>Body AI: {bodyReady ? '✓' : '✗'}</div>
          <div>Face AI: {faceReady ? '✓' : '✗'}</div>
          <div>Video: {webcamRef.current?.video?.readyState === 4 ? '✓' : '✗'}</div>
        </div>
      )}
    </div>
  )
}

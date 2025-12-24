'use client'

import { useRef, useEffect } from 'react'
import Webcam from 'react-webcam'
import { useFaceDetection, FacePosition } from '@/hooks/useFaceDetection'

interface FaceTrackerProps {
  onFaceDetected: (position: FacePosition | null) => void
  showWebcam?: boolean
}

export function FaceTracker({ onFaceDetected, showWebcam = false }: FaceTrackerProps) {
  const webcamRef = useRef<Webcam>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const { detectFace, facePosition, isLoading, error, isReady } = useFaceDetection()

  // Pass face position to parent component
  useEffect(() => {
    onFaceDetected(facePosition)
  }, [facePosition, onFaceDetected])

  // Detection loop
  useEffect(() => {
    if (!isReady) return

    const detect = () => {
      if (webcamRef.current?.video) {
        const video = webcamRef.current.video
        if (video.readyState === 4) {
          detectFace(video)
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
  }, [isReady, detectFace])

  // Debug info (only log important state changes)
  useEffect(() => {
    if (error) {
      console.error('FaceTracker error:', error)
    }
    if (isReady && !isLoading) {
      console.log('✅ Face tracking ready!')
    }
  }, [isLoading, error, isReady])

  return (
    <div className="fixed top-4 right-4 z-50">
      {isLoading && (
        <div className="bg-blue-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Loading face detection model...
        </div>
      )}

      {error && (
        <div className="bg-red-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Error: {error}
        </div>
      )}

      {isReady && !facePosition && (
        <div className="bg-yellow-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Ready - Looking for face...
        </div>
      )}

      {facePosition && (
        <div className="bg-green-500/80 text-white px-4 py-2 rounded-lg mb-2">
          Face detected! ({Math.round(facePosition.confidence * 100)}%)
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
          facePosition ? 'border-green-500' : 'border-gray-500'
        } ${showWebcam ? 'opacity-100' : 'opacity-0 w-0 h-0'}`}
        style={{ maxWidth: '200px' }}
        onUserMedia={() => console.log('Webcam started!')}
        onUserMediaError={(err) => console.error('Webcam error:', err)}
      />

      {showWebcam && facePosition && (
        <div className="mt-2 bg-black/80 text-white px-3 py-2 rounded-lg text-xs font-mono">
          <div>X: {facePosition.x.toFixed(2)}</div>
          <div>Y: {facePosition.y.toFixed(2)}</div>
        </div>
      )}

      {showWebcam && isReady && (
        <div className="mt-2 bg-black/80 text-white px-3 py-2 rounded-lg text-xs">
          <div>Model: {isReady ? '✓ Ready' : '✗ Not ready'}</div>
          <div>Video: {webcamRef.current?.video?.readyState === 4 ? '✓ Playing' : '✗ Not ready'}</div>
        </div>
      )}
    </div>
  )
}

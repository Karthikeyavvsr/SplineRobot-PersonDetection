'use client'

import { useRef, useEffect, useState } from 'react'
import Webcam from 'react-webcam'

export default function TestWebcam() {
  const webcamRef = useRef<Webcam>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        console.log('Video ready state:', webcamRef.current.video.readyState)
        if (webcamRef.current.video.readyState === 4) {
          setIsReady(true)
        }
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-4">Webcam Test</h1>

      <div className="mb-4">
        <p>Video Ready: {isReady ? '✅ Yes' : '❌ No'}</p>
        <p>Ready State: {webcamRef.current?.video?.readyState || 'N/A'}</p>
      </div>

      <Webcam
        ref={webcamRef}
        audio={false}
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: 'user'
        }}
        className="border-2 border-white"
        onUserMedia={() => {
          console.log('✅ Webcam started!')
          setIsReady(true)
        }}
        onUserMediaError={(err) => console.error('❌ Webcam error:', err)}
      />
    </div>
  )
}

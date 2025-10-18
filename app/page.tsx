'use client'

import { useState } from 'react'
import { InteractiveSpline } from "@/components/ui/interactive-spline"
import { CombinedTracker } from "@/components/CombinedTracker"

export default function Home() {
  const [position, setPosition] = useState({
    x: 0,
    y: 0,
    isPersonNear: false,
    personDetected: false
  })
  const [showWebcam, setShowWebcam] = useState(true)

  const handlePositionDetected = (pos: {
    x: number
    y: number
    isPersonNear: boolean
    personDetected: boolean
  }) => {
    setPosition(pos)
  }

  return (
    <div className="min-h-screen w-full relative bg-black">
      {/* Main Spline Robot */}
      <div className="w-full h-screen">
        <InteractiveSpline
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="w-full h-full"
          faceX={position.x}
          faceY={position.y}
          isPersonNear={position.isPersonNear}
          personDetected={position.personDetected}
        />
      </div>

      {/* Combined Body + Face Tracking */}
      <CombinedTracker
        onPositionDetected={handlePositionDetected}
        showWebcam={showWebcam}
      />

      {/* Toggle Webcam Visibility */}
      <button
        onClick={() => setShowWebcam(!showWebcam)}
        className="fixed bottom-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 transition-all z-50"
      >
        {showWebcam ? 'Hide' : 'Show'} Webcam
      </button>

      {/* Status Display */}
      <div className="fixed bottom-4 left-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm border border-white/20 z-50">
        <h3 className="font-semibold mb-2">Robot Status</h3>
        {position.personDetected ? (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                position.isPersonNear ? 'bg-purple-500' : 'bg-green-500'
              }`}></div>
              <span>{position.isPersonNear ? 'Mimicking Mode' : 'Tracking Mode'}</span>
            </div>
            <div className="text-xs text-gray-300 mt-2">
              Position: ({position.x.toFixed(2)}, {position.y.toFixed(2)})
            </div>
            {position.isPersonNear && (
              <div className="text-xs text-purple-300 font-semibold">
                🎭 Copying your head movements!
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>Looking for person...</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="fixed top-4 left-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm border border-white/20 z-40 max-w-xs">
        <h3 className="font-semibold mb-2">Interactive Robot</h3>
        <p className="text-sm text-gray-300 mb-3">
          🤖 The robot tracks and interacts with you in multiple ways:
        </p>
        <ul className="text-xs text-gray-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span><strong>Far away:</strong> Tracks your body movement and waves arms</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span><strong>Close up:</strong> Mimics your head movements playfully!</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

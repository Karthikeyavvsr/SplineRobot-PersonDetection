# Interactive Spline Robot with Face Tracking

An interactive 3D robot powered by Spline that follows your face movements in real-time using MediaPipe face detection.

## Features

- **Real-time Face Tracking**: Uses MediaPipe's BlazeFace model to detect and track your face
- **Interactive 3D Robot**: Spline-powered 3D robot that responds to your movements
- **Camera Following**: Robot camera/head rotates to follow detected face position
- **Live Status Display**: Real-time tracking status and face position coordinates
- **Webcam Toggle**: Show/hide webcam preview

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Styling
- **Spline** - 3D interactive design
- **MediaPipe** - Face detection AI model
- **react-webcam** - Webcam access in React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Webcam-enabled device
- Modern browser with WebRTC support (Chrome, Edge, Safari)

### Installation

```bash
cd ~/Desktop/spline-robot-demo
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Time Setup

1. **Allow Camera Access**: When prompted, allow the browser to access your webcam
2. **Position Your Face**: Make sure your face is visible in the webcam
3. **Watch the Robot**: The robot will start tracking your movements!

## How It Works

### Face Detection Flow

```
Webcam → MediaPipe Face Detector → Face Position (x, y) →
Spline Robot → Camera/Head Rotation → Visual Feedback
```

### Key Components

#### 1. Face Detection Hook (`hooks/useFaceDetection.ts`)
- Initializes MediaPipe BlazeFace model
- Detects faces at 10 FPS for performance
- Normalizes face position to -1 to 1 range

#### 2. Face Tracker Component (`components/FaceTracker.tsx`)
- Manages webcam stream
- Runs detection loop
- Displays tracking status

#### 3. Interactive Spline Component (`components/ui/interactive-spline.tsx`)
- Loads Spline 3D scene
- Receives face position updates
- Rotates camera/robot to follow face

#### 4. Main Page (`app/page.tsx`)
- Orchestrates all components
- Manages state
- Provides UI controls

## Customization

### Adjust Tracking Sensitivity

Edit `components/ui/interactive-spline.tsx`:

```typescript
// Less sensitive (slower movement)
const rotationY = faceX * 0.3

// More sensitive (faster movement)
const rotationY = faceX * 0.8
```

### Change Detection Frequency

Edit `hooks/useFaceDetection.ts`:

```typescript
// Faster detection (more CPU usage)
const detectionInterval = 50 // 20 FPS

// Slower detection (less CPU usage)
const detectionInterval = 200 // 5 FPS
```

### Modify Spline Scene

Replace the scene URL in `app/page.tsx`:

```typescript
<InteractiveSpline
  scene="YOUR_SPLINE_URL_HERE"
  // ...
/>
```

### Robot Object Names

The code looks for these object names in your Spline scene:
- `Camera` - Main camera
- `Robot` - Robot object
- `Head` - Robot head
- `Character` - Character object

Update object names in `interactive-spline.tsx` to match your scene.

## Performance Tips

1. **Close Unnecessary Tabs**: Face detection is CPU-intensive
2. **Good Lighting**: Better lighting = better detection
3. **Stable Position**: Keep webcam steady for smooth tracking
4. **Reduce Quality**: Lower webcam resolution if laggy

## Troubleshooting

### Camera Not Working
- Check browser permissions
- Ensure no other app is using webcam
- Try different browser (Chrome recommended)

### Robot Not Moving
1. Check console for Spline object names
2. Verify face is detected (green indicator)
3. Adjust sensitivity values

### Low FPS / Laggy
- Lower `detectionInterval` value
- Reduce webcam resolution
- Close other applications

## Project Structure

```
spline-robot-demo/
├── app/
│   ├── page.tsx          # Main page with robot
│   └── globals.css       # Global styles
├── components/
│   ├── ui/
│   │   ├── splite.tsx              # Basic Spline wrapper
│   │   ├── interactive-spline.tsx  # Interactive Spline with tracking
│   │   ├── card.tsx                # UI card component
│   │   └── spotlight-*.tsx         # Spotlight effects
│   └── FaceTracker.tsx   # Webcam + face detection
├── hooks/
│   └── useFaceDetection.ts  # MediaPipe face detection hook
└── lib/
    └── utils.ts          # Utility functions
```

## Future Enhancements

- [ ] Add pose detection for full-body tracking
- [ ] Add hand gesture controls
- [ ] Multiple face tracking
- [ ] Voice interaction
- [ ] Mobile optimization
- [ ] Recording/screenshot features
- [ ] Custom robot animations based on distance
- [ ] Eye-tracking for more precise interaction

## Resources

- [MediaPipe Documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector)
- [Spline Documentation](https://docs.spline.design/)
- [Next.js Documentation](https://nextjs.org/docs)

## License

MIT

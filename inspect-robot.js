// Add this temporarily to interactive-spline.tsx handleLoad function
// to inspect robot components

const handleLoad = (spline) => {
  splineRef.current = spline
  if (onLoad) onLoad(spline)

  spline.setZoom(1)

  console.log('=== ROBOT COMPONENT INSPECTION ===')
  
  // Try to get all objects
  const allObjects = spline.getAllObjects?.() || []
  console.log('All available objects:', allObjects)
  
  // Look for common robot part names
  const robotParts = [
    'Head', 'head', 'Bot Head', 'Robot Head', 'Top part',
    'Arm', 'arm', 'Right Arm', 'Left Arm', 'RightArm', 'LeftArm',
    'Hand', 'hand', 'Right Hand', 'Left Hand', 'RightHand', 'LeftHand',
    'Shoulder', 'shoulder', 'Right Shoulder', 'Left Shoulder',
    'Body', 'body', 'Chest', 'chest', 'Torso', 'torso',
    'Bot', 'robot', 'Robot', 'Character'
  ]
  
  console.log('=== SEARCHING FOR ROBOT PARTS ===')
  robotParts.forEach(partName => {
    const obj = spline.findObjectByName(partName)
    if (obj) {
      console.log(`✓ Found: ${partName}`, obj)
      console.log(`  - Position:`, obj.position)
      console.log(`  - Rotation:`, obj.rotation) 
      console.log(`  - Scale:`, obj.scale)
      console.log(`  - Name:`, obj.name)
      console.log(`  - ID:`, obj.id || 'No ID')
    }
  })
  
  console.log('=== END ROBOT INSPECTION ===')
}

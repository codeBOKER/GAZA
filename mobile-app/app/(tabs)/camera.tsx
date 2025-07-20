import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Text, Animated, PanResponder, Dimensions, Image } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CameraView from '@/components/CameraView';

const { height: screenHeight } = Dimensions.get('window');

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const [isContainerExpanded, setIsContainerExpanded] = useState(true); // Track container state
  
  // Drag functionality for white container
  const containerHeight = useRef(new Animated.Value(screenHeight * 0.75)).current;
  const minHeight = screenHeight * 0.25; // Minimum 25% of screen
  const maxHeight = screenHeight * 0.75; // Maximum 75% of screen
  
  // Listen to container height changes to update button state
  useEffect(() => {
    const listener = containerHeight.addListener(({ value }) => {
      const threshold = (minHeight + maxHeight) / 2;
      setIsContainerExpanded(value > threshold);
    });
    
    return () => {
      containerHeight.removeListener(listener);
    };
  }, [containerHeight, minHeight, maxHeight]);
  
  const currentHeightValue = useRef(screenHeight * 0.75);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // More sensitive - respond to smaller movements
        return Math.abs(gestureState.dy) > 3;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        containerHeight.setOffset(currentHeightValue.current);
        containerHeight.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Smooth real-time movement
        const newHeight = -gestureState.dy;
        // Clamp during movement to prevent going beyond bounds
        const clampedHeight = Math.max(
          minHeight - currentHeightValue.current,
          Math.min(maxHeight - currentHeightValue.current, newHeight)
        );
        containerHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        containerHeight.flattenOffset();
        const finalHeight = currentHeightValue.current - gestureState.dy;
        
        // Snap to nearest position based on velocity and position
        let targetHeight;
        const velocity = gestureState.vy;
        
        if (Math.abs(velocity) > 0.5) {
          // Fast gesture - snap based on direction
          targetHeight = velocity < 0 ? maxHeight : minHeight;
        } else {
          // Slow gesture - snap to nearest
          targetHeight = finalHeight < (minHeight + maxHeight) / 2 ? minHeight : maxHeight;
        }
        
        // Clamp the height within bounds
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, targetHeight));
        currentHeightValue.current = clampedHeight;
        
        Animated.spring(containerHeight, {
          toValue: clampedHeight,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
      },
    })
  ).current;
  
  useEffect(() => {
    // Request permissions when component mounts
    const requestPermissions = async () => {
      try {
        // In a real implementation, we would request camera permissions here
        setHasPermission(true);
      } catch (error) {
        console.error('Error requesting permissions:', error);
        setHasPermission(false);
      }
    };
    
    requestPermissions();
  }, []);

  const takePicture = () => {
    Alert.alert('Success', 'Photo captured successfully!');
  };

  const handlePressIn = () => {
    const timer = setTimeout(() => {
      takePicture();
    }, 1000); // 1 second
    setPressTimer(timer);
  };

  const handlePressOut = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const pickImage = () => {
    Alert.alert('Info', 'Select from gallery pressed');
  };
  
  const collapseContainer = () => {
    setIsContainerExpanded(false);
    currentHeightValue.current = minHeight;
    
    Animated.spring(containerHeight, {
      toValue: minHeight,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };
  
  const handleButtonPress = () => {
    if (isContainerExpanded) {
      collapseContainer();
    } else {
      pickImage();
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.container}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
      {/* Camera background */}
      <CameraView style={styles.cameraView} />
      
      {/* Scanner overlay for the camera area - touchable for photo capture */}
      <View
        style={styles.scannerOverlay}
      >
        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>Hold for 1 second to capture</Text>
        </View>
      </View>
      </TouchableOpacity>
      {/* White container taking 75% from bottom - blocks touch */}
      <Animated.View style={[styles.whiteContainer, { height: containerHeight }]} pointerEvents="auto">
        {/* Draggable header area */}
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          {/* Home indicator line like iPhone */}
          <View style={styles.homeIndicator} />
        </View>
        
        {/* Select from gallery button / Close button in top right */}
        <TouchableOpacity
          style={styles.pickImageButton}
          onPress={handleButtonPress}
        >
          {isContainerExpanded ? (
            <Text style={styles.closeIcon}>×</Text>
          ) : (
            <Image 
              source={require('@/assets/images/image.png')} 
              style={styles.pickImageIcon}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
        
        {/* Content inside white container */}
      </Animated.View>
    
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  cameraView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scannerOverlay: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: -100 }], // Center vertically
  },
  whiteContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scannerFrame: {
    width: 280,
    height: 400,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  pickImageButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickImageIcon: {
    width: 23,
    height: 23,
  },
  closeIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor:'rgba(0, 0, 0, 0.12)',
    color: '#333',
    textAlign: 'center',
    width: 26,
    height: 26,
    borderRadius: 12,
    lineHeight: 23,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  instructionText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionContainer: {
    top: '10%',
    backgroundColor: 'rgba(117, 117, 117, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    marginTop: 7,
    backgroundColor: '#000',
    borderRadius: 3,
    alignSelf: 'center',
    opacity: 0.3,
  },
  dragArea: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
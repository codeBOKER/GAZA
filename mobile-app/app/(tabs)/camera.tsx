import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Text, Animated, PanResponder, Dimensions, Image, ScrollView } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CameraView from '@/components/CameraView';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(false);

  const [isContainerExpanded, setIsContainerExpanded] = useState(true); // Track container state
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [isBoycottAlert, setIsBoycottAlert] = useState(false); // TRUE = red (boycott), FALSE = green (safe)
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Update screen dimensions on changes (orientation, etc.)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });
    return () => subscription?.remove();
  }, []);
  
  // Drag functionality for white container
  const screenHeight = screenDimensions.height;
  const containerHeight = useRef(new Animated.Value(screenHeight * 0.75)).current;
  const minHeight = screenHeight * 0.25; // Minimum 25% of screen
  const maxHeight = screenHeight * 0.75; // Maximum 75% of screen
  const currentHeightValue = useRef(screenHeight * 0.75);
  
  // Update container height when screen dimensions change
  useEffect(() => {
    const newMaxHeight = screenHeight * 0.75;
    const newMinHeight = screenHeight * 0.25;
    currentHeightValue.current = newMaxHeight;
    
    // Update container to new max height if it was previously at max
    containerHeight.setValue(newMaxHeight);
  }, [screenHeight, containerHeight]);
  
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
    // Simulate capturing an image - in real app this would be actual camera capture
    setCapturedImage('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='); // Placeholder base64 image
  };

  const confirmSend = () => {
    Alert.alert('Success', 'Image sent for analysis!');
    setCapturedImage(null); // Reset to camera view
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
      {/* Camera background or captured image */}
      {capturedImage ? (
        <Image source={{ uri: capturedImage }} style={styles.cameraView} />
      ) : (
        <CameraView style={styles.cameraView} />
      )}
      
      {/* Scanner overlay for the camera area */}
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            {capturedImage ? 'Confirm to send this image' : 'Tap the button below to capture'}
          </Text>
        </View>
        <TouchableOpacity 
          style={capturedImage ? styles.sendButton : styles.captureButton} 
          onPress={capturedImage ? confirmSend : takePicture}
        >
          {capturedImage ? (
            <Text style={styles.sendIcon}>➤</Text>
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>
      </View>
      {/* White container taking 75% from bottom - blocks touch */}
      <Animated.View style={[styles.whiteContainer, { height: containerHeight }]} pointerEvents="auto">
        {/* Dynamic color circle on top left */}
        <View style={[
          styles.alertCircle, 
          { backgroundColor: isBoycottAlert ? '#F44336' : '#4CAF50' }
        ]} />
        
        {/* Draggable header area */}
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          {/* Home indicator line like iPhone */}
          <View style={styles.homeIndicator} />
        
        
          {/* Dynamic color text container between company and home indicator */}
          <View style={[
            styles.alertTextContainer,
            { backgroundColor: isBoycottAlert ? '#FFEBEE' : '#E8F5E8' }
          ]}>
            <Text style={[
              styles.alertText,
              { color: isBoycottAlert ? '#C62828' : '#2E7D32' }
            ]}>
              {isBoycottAlert ? 'Boycott Alert' : 'Safe Alternative'}
            </Text>
          </View>
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
        <View style={styles.contentContainer}>
          {/* First row - Company */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company: </Text>
            <Text style={[
              styles.infoValue,
              isBoycottAlert && styles.strikethroughText
            ]}>Coca cola</Text>
          </View>
          
          {/* Separator line */}
          <View style={styles.separatorLine} />
          
          {/* Second row - Why */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Why: </Text>
            <Text style={styles.infoValueSmall}>
              {isBoycottAlert 
                ? "Supports Israeli military operations in Gaza" 
                : "Ethical alternative that doesn't support violence"}
            </Text>
          </View>
          
          {/* Separator line */}
          <View style={styles.separatorLine} />
          
          {/* Alternatives row */}
          <View style={styles.alternativesSection}>
            <Text style={styles.alternativesTitle}>Alternatives:</Text>
            <ScrollView 
              style={styles.alternativesScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.alternativesGrid}>
                {/* First row */}
                <View style={styles.alternativeRow}>
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>Pepsi</Text>
                  </View>
                  
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>Local Brand</Text>
                  </View>
                </View>
                
                {/* Second row */}
                <View style={styles.alternativeRow}>
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>7UP</Text>
                  </View>
                  
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>Sprite</Text>
                  </View>
                </View>
                
                {/* Third row */}
                <View style={styles.alternativeRow}>
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>Fanta</Text>
                  </View>
                  
                  <View style={styles.alternativeItem}>
                    <View style={styles.alternativeImagePlaceholder}>
                      <Text style={styles.placeholderText}>IMG</Text>
                    </View>
                    <Text style={styles.alternativeCompanyName}>Mountain Dew</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
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
    paddingHorizontal: 0,
  },
  scannerFrame: {
    width: '80%',
    height: '180%',
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
    backgroundColor:'rgba(0, 0, 0, 0.16)',
    color: '#333',
    textAlign: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    lineHeight: 25,
  },
  captureButton: {
    position: 'absolute',
    bottom: '-90%',
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
  sendButton: {
    position: 'absolute',
    bottom: '-90%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  sendIcon: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  instructionText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionContainer: {
    top: '5%',
    backgroundColor: 'rgba(117, 117, 117, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  homeIndicator: {
    width: 134,
    height: 5,
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
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    minWidth: 90,
  },
  infoValue: {
    fontSize: 18,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  infoValueSmall: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
    marginHorizontal: 0,
  },
  alternativesSection: {
    paddingTop: 10,
  },
  alternativesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  alternativesScrollView: {
    flex: 1,
    maxHeight: 240,
  },
  alternativesGrid: {
    paddingBottom: 5,
  },
  alternativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alternativeItem: {
    alignItems: 'center',
    width: '45%',
  },
  alternativeImagePlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  placeholderText: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  alternativeCompanyName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  greenCircle: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    zIndex: 10,
  },
  greenTextContainer: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  greenText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertCircle: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 10,
  },
  alertTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 20,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
});
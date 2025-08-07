import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Text, Animated, PanResponder, Dimensions, Image, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CameraView, { CameraViewRef } from '@/components/CameraView';
import * as FileSystem from 'expo-file-system';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://gaza-g4rl.onrender.com/ws/analyze/';
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewRef>(null);

  const [isContainerExpanded, setIsContainerExpanded] = useState(true); 
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [isBoycottAlert, setIsBoycottAlert] = useState(false); 
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [companyName, setcompanyName] = useState<string | null>(null);
  const [cause, setCause] = useState<string | null>(null);
  const [productType, setProductType] = useState<string | null>(null);
  const [alternativeItems, setAlternativeItems] = useState<any[]>([]);
  const [country, setCountry] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const res = await fetch('http://ip-api.com/json/');
        const data = await res.json();
        setCountry(data.country);
      } catch (e) {
        console.log('Failed to fetch country', e);
      }
    };

    fetchCountry(); 
  }, []);
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
  
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setIsProcessing(true); 
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          setCapturedImage(photo.uri);
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Camera Error', 'Failed to capture image. Please try again.');
      } finally {
        setIsProcessing(false); 
      }
    }
  };


  
  const confirmSend = async () => {
    if (!capturedImage) return;
    
    // Convert to base64 only when sending
    const base64 = await FileSystem.readAsStringAsync(capturedImage, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const base64Image = `data:image/jpeg;base64,${base64}`;
    
    setcompanyName("Analyzing...");
    setProductType("");
    setCause("...");
    setAlternativeItems([]);
    setIsBoycottAlert(false);
    setCapturedImage(null);

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        image_data: base64Image,
        country: country,
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "company") {
        setcompanyName(data.value);
      } else if (data.type === "product_type") {
        setProductType(data.value);
      } else if (data.type === "boycott") {
        setIsBoycottAlert(data.value);
      } else if (data.type === "cause") {
        setCause(data.value); 
      } else if (data.type === "alternative") {
        setAlternativeItems(data.value);
      }

      if (data.type === "done") {
         ws.close();
      }
    };

    ws.onerror = (error) => {
      Alert.alert('Error', 'Failed to analyze image');
      console.error('WebSocket error:', error);
    };
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      // Store URI in RAM for preview
      setCapturedImage(result.assets[0].uri);
    }
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

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera background or captured image */}
      <TouchableOpacity 
        style={styles.cameraView} 
        onPress={capturedImage ? () => setCapturedImage(null) : undefined}
        activeOpacity={capturedImage ? 0.8 : 1}
      >
        {capturedImage ? (
          <Image source={{ uri: capturedImage }} style={styles.cameraView} />
        ) : (
          <CameraView ref={cameraRef} style={styles.cameraView} />
        )}
      
      
      {/* Scanner overlay for the camera area */}
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        {isProcessing? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.processingText}>Processing image...</Text>
          </View>
        ): 
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            {capturedImage ? 'Confirm to send this image' : 'Tap the button below to capture'}
          </Text>
        </View>
        }
        
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
      </TouchableOpacity>
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
            ]}>{companyName}
            </Text>
            <Text style={styles.infoValueSmall}> {productType}</Text>
          </View>
          
          {/* Separator line */}
          <View style={styles.separatorLine} />
          
          {/* Second row - Why */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Why: </Text>
            <Text style={styles.infoValueSmall}>
              {cause}
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
                { isBoycottAlert ? alternativeItems.map((alt, index) => (
                  <View key={index} style={styles.alternativeRow}>
                    <View style={styles.alternativeItem}>
                      <View style={styles.alternativeImagePlaceholder}>
                        {alt.image_url ? (
                          <Image source={{ uri: alt.image_url }} style={styles.alternativeImage} />
                        ) : (
                          <Text style={styles.placeholderText}>IMG</Text>
                        )}
                      </View>
                      <Text style={styles.alternativeCompanyName}>{alt.company_name || 'Unknown'}</Text>
                      <Text style={styles.alternativeProductName}>{alt.product_name === alt.company_name ? alt.product_type : alt.product_name}</Text>
                    </View>
                  </View>
                )):<Text style={styles.infoValue}> Alternative products will appeare here .. </Text> }
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
  alternativeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
    flex: 1,
  },
  alternativesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  alternativesScrollView: {
    maxHeight: 250,
  },
  alternativesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingBottom: 10,
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
    marginBottom: 15,
  },
  alternativeImagePlaceholder: {
    width: 150,
    height: 170,
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
  alternativeProductName: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontWeight: '400',
    marginTop: 2,
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
  loadingView: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  processingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
});
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Text, Animated, PanResponder, Dimensions, Image, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CameraView, { CameraViewRef } from '@/components/CameraView';
import * as FileSystem from 'expo-file-system';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { t } from '@/i18n/translations';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://gaza-g4rl.onrender.com/ws/analyze/';
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewRef>(null);
  const { language } = useLanguage();
  const router = useRouter();
  const isRTL = language === 'ar' || language === 'ur';

  // Map language codes to human-readable language names
  const languageNames: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    tr: 'Turkish',
    ur: 'Urdu',
  };

  const getLanguageName = (code: string | null) => (code ? languageNames[code] || code : null);

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

  // Force user to select a language on first launch
  useEffect(() => {
    if (!language) {
      router.replace('/language-select' as any);
    }
  }, [language, router]);
  
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
        if (photo && photo.uri) {
          // Enforce a centered 3:4 crop on the captured image, then resize/compress
          const targetRatio = 3 / 4; // width / height
          let actions: ImageManipulator.Action[] = [];

          const srcWidth = (photo as any).width as number | undefined;
          const srcHeight = (photo as any).height as number | undefined;

          if (srcWidth && srcHeight) {
            const currentRatio = srcWidth / srcHeight;
            if (currentRatio > targetRatio) {
              // Too wide: crop width
              const newWidth = Math.round(srcHeight * targetRatio);
              const originX = Math.round((srcWidth - newWidth) / 2);
              actions.push({ crop: { originX, originY: 0, width: newWidth, height: srcHeight } });
            } else if (currentRatio < targetRatio) {
              // Too tall: crop height
              const newHeight = Math.round(srcWidth / targetRatio);
              const originY = Math.round((srcHeight - newHeight) / 2);
              actions.push({ crop: { originX: 0, originY, width: srcWidth, height: newHeight } });
            }
          }

          // After crop, downscale to a reasonable width
          actions.push({ resize: { width: 800 } });

          const processed = await ImageManipulator.manipulateAsync(
            photo.uri,
            actions,
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
          );

          setCapturedImage(processed.uri);
        } else {
          Alert.alert(t(language, 'error'), 'No photo was taken');
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert(t(language, 'cameraError'), t(language, 'cameraErrorMsg'));
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
    
    setcompanyName(t(language, 'analyzing'));
    setProductType("");
    setCause("...");
    setAlternativeItems([]);
    setIsBoycottAlert(false);
    setCapturedImage(null);
    const langToSend = getLanguageName(language);
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        image_data: base64Image,
        country: country,
        language: langToSend,
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
      Alert.alert(t(language, 'error'), t(language, 'failedAnalyze'));
      console.error('WebSocket error:', error);
    };
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
      aspect: [3, 4],
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
        <Text>{t(language, 'noCamera')}</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text>{t(language, 'grantCamera')}</Text>
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
            <Text style={styles.processingText}>{t(language, 'processing')}</Text>
          </View>
        ): 
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            {capturedImage ? t(language, 'confirmSend') : t(language, 'tapToCapture')}
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
          { backgroundColor: isBoycottAlert ? '#e81a13' : '#2E7D32' }
        ]} />
        
        {/* Draggable header area */}
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          {/* Home indicator line like iPhone */}
          <View style={styles.homeIndicator} />
        
        
          {/* Dynamic color text container between company and home indicator */}
          <View style={[
            styles.alertTextContainer,
            { backgroundColor: isBoycottAlert ? '#432818' : '#3E3E3E', borderRadius: 8 }
          ]}>
            <Text style={[
              styles.alertText,
              { color: isBoycottAlert ? '#C62828' : '#2E7D32' }
            ]}>
              {isBoycottAlert ? t(language, 'boycottAlert') : t(language, 'safeAlternative')}
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
          <View style={[styles.infoRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>{t(language, 'company')} </Text>
            <Text style={[
              styles.infoValue,
              isBoycottAlert && styles.strikethroughText,
              isRTL && { textAlign: 'left' }
            ]}>{companyName}
            </Text>
            <Text style={[styles.infoValueSmall, isRTL && { textAlign: 'left' }]}> {productType}</Text>
          </View>
          
          {/* Separator line */}
          <View style={styles.separatorLine} />
          
          {/* Second row - Why */}
          <View style={[styles.infoRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>{t(language, 'why')} </Text>
            <Text style={[styles.infoValueSmall, isRTL && { textAlign: 'left' }]}>
              {cause}
            </Text>
            
          </View>
          
          {/* Separator line */}
          <View style={styles.separatorLine} />
          
          {/* Alternatives row */}
          <View style={styles.alternativesSection}>
            <Text style={[styles.alternativesTitle, isRTL && { textAlign: 'right' }]}>{t(language, 'alternatives')}</Text>
            <ScrollView 
              style={styles.alternativesScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.alternativesGrid, isRTL && { flexDirection: 'row-reverse' }]}>
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
                )):<Text style={styles.infoValue}> {t(language, 'altPlaceholder')} </Text> }
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
    backgroundColor: '#2f2a29',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  scannerFrame: {
    width: '80%',
    aspectRatio: 3 / 4,
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
    backgroundColor:'rgba(255, 255, 255, 0.16)',
    color: 'rgba(255, 255, 255, 0.66)',
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
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionContainer: {
    backgroundColor: 'rgba(232, 26, 19, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    backgroundColor: '#e0d7d6',
    borderRadius: 3,
    alignSelf: 'center',
    opacity: 0.25,
  },
  alternativeImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    resizeMode: 'cover',
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
    color: '#ffffff',
    minWidth: 90,
  },
  infoValue: {
    fontSize: 18,
    color: '#e0d7d6',
    flex: 1,
    textAlign: 'center',
  },
  infoValueSmall: {
    fontSize: 14,
    color: '#c9bdbb',
    flex: 1,
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#4a4443',
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
    color: '#ffffff',
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
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#3a3433',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4a4443',
  },
  placeholderText: {
    fontSize: 10,
    color: '#c9bdbb',
    fontWeight: '500',
  },
  alternativeCompanyName: {
    fontSize: 12,
    color: '#e0d7d6',
    textAlign: 'center',
    fontWeight: '500',
  },
  alternativeProductName: {
    fontSize: 10,
    color: '#c9bdbb',
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
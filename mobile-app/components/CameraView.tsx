import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

interface CameraViewProps {
  style?: ViewStyle;
}

export interface CameraViewRef {
  takePictureAsync: () => Promise<{ uri: string } | null>;
}

const CameraView = forwardRef<CameraViewRef, CameraViewProps>(({ style }, ref) => {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useImperativeHandle(ref, () => ({
    takePictureAsync: async () => {
      if (cameraRef.current) {
        return await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true});
      }
      return null;
    },
  }));

  if (!permission?.granted) {
    requestPermission();
    return null;
  }

  return (
    <ExpoCameraView
      ref={cameraRef}
      style={[styles.camera, style]}
      facing="back"
    />
  );
});

CameraView.displayName = 'CameraView';

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
});

export default CameraView;
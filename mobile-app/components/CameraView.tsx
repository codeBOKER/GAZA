import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

interface CameraViewProps {
  style?: ViewStyle;
  torchOn?: boolean;
}

export interface CameraViewRef {
  takePictureAsync: () => Promise<{ uri: string; width?: number; height?: number } | null>;
}

const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  ({ style, torchOn = false }, ref) => {
    const cameraRef = useRef<ExpoCameraView>(null);

    useImperativeHandle(ref, () => ({
      takePictureAsync: async () => {
        if (cameraRef.current) {
          const photo: any = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.5,
            skipProcessing: true,
          });
          return { uri: photo?.uri, width: photo?.width, height: photo?.height };
        }
        return null;
      },
    }));

    return (
      <ExpoCameraView
        ref={cameraRef}
        style={[styles.camera, style]}
        facing="back"
        enableTorch={torchOn}
      />
    );
  }
);

CameraView.displayName = 'CameraView';

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
});

export default CameraView;

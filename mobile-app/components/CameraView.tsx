import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface CameraViewProps {
  style?: ViewStyle;
}

// This is a placeholder component that will be replaced with the actual camera implementation
// when we're ready to integrate it
export default function CameraView({ style }: CameraViewProps) {
  return (
    <View style={[styles.mockCamera, style]} />
  );
}

const styles = StyleSheet.create({
  mockCamera: {
    flex: 1,
    backgroundColor: '#000',
  },
});
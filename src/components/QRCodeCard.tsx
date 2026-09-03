import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/useTheme';

interface QRCodeCardProps {
  value: string;
  size?: number;
}

export function QRCodeCard({ value, size = 180 }: QRCodeCardProps) {
  const { spacing, radius } = useTheme();

  return (
    // Intentionally fixed white/near-black, not theme colors — a QR scanner needs
    // this exact high contrast, which a dark-theme surface/text swap would break.
    <View style={[styles.wrap, { backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: spacing.base }]}>
      <QRCode value={value} size={size} color="#050505" backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});

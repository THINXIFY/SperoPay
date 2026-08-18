import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';

interface AppBottomSheetProps extends Partial<BottomSheetProps> {
  children: React.ReactNode;
}

export const AppBottomSheet = forwardRef<BottomSheet, AppBottomSheetProps>(({ children, ...rest }, ref) => {
  const { colors, spacing, radius } = useTheme();
  const snapPoints = useMemo(() => ['40%', '70%'], []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
      {...rest}
    >
      <BottomSheetView style={[styles.content, { paddingHorizontal: spacing.base, paddingBottom: spacing.xl }]}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});
AppBottomSheet.displayName = 'AppBottomSheet';

const styles = StyleSheet.create({
  content: { flex: 1 },
});

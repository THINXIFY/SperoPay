import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';

interface AppBottomSheetProps extends Partial<BottomSheetProps> {
  children: React.ReactNode;
  // Use for content whose length isn't bounded (e.g. a customer picker) —
  // BottomSheetView doesn't scroll, so unbounded content overflows past the
  // sheet's snap height with no way to reach it.
  scrollable?: boolean;
}

export const AppBottomSheet = forwardRef<BottomSheet, AppBottomSheetProps>(
  ({ children, scrollable, ...rest }, ref) => {
    const { colors, spacing, radius } = useTheme();
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(() => ['40%', '70%'], []);
    const contentPadding = {
      paddingHorizontal: spacing.base,
      paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.base),
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        // @gorhom/bottom-sheet v5 defaults enableDynamicSizing to true, which
        // measures content and fights with the explicit snapPoints above —
        // the sheet ends up rendering at its measured content height instead
        // of the intended 40%/70% snap, appearing partially opened/clipped.
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        )}
        {...rest}
      >
        {scrollable ? (
          <BottomSheetScrollView contentContainerStyle={[styles.contentContainer, contentPadding]}>
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[styles.content, contentPadding]}>{children}</BottomSheetView>
        )}
      </BottomSheet>
    );
  }
);
AppBottomSheet.displayName = 'AppBottomSheet';

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { flexGrow: 1 },
});

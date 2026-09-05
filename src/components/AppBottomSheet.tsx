import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
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
  // Overrides the sheet's initial index (default -1, closed). The ONLY
  // legitimate reason to set this is a sheet that's conditionally/lazily
  // mounted already-targeting-open on its very first render (see
  // request/amount.tsx): gorhom always starts the animated position fully
  // closed regardless of this value (animateOnMount, on by default) and
  // then animates to it once native layout resolves -- that mount pathway
  // is layout-aware, unlike calling the imperative .expand() ref method
  // immediately after a fresh mount, which silently no-ops if layout
  // hasn't resolved yet (a one-shot check, not a queued/retried request).
  // Every other consumer should leave this at its default and control
  // open/close purely through the ref API.
  initialIndex?: number;
}

export const AppBottomSheet = forwardRef<BottomSheet, AppBottomSheetProps>(
  ({ children, scrollable, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius } = useTheme();
    const snapPoints = useMemo(() => ['40%', '70%'], []);
    // Not adding useSafeAreaInsets() here: every screen that hosts a sheet
    // already wraps its content in a SafeAreaView with edges including
    // 'bottom' (or, for tab-root screens, the tab bar itself already
    // applies the inset) — adding it again here double-counted the inset
    // on top of an already-inset container.
    const contentPadding = useMemo(
      () => ({ paddingHorizontal: spacing.base, paddingBottom: spacing.xl }),
      [spacing.base, spacing.xl]
    );

    return (
      <BottomSheet
        ref={ref}
        snapPoints={snapPoints}
        // @gorhom/bottom-sheet v5 defaults enableDynamicSizing to true, which
        // measures content and fights with the explicit snapPoints above —
        // the sheet ends up rendering at its measured content height instead
        // of the intended 40%/70% snap, appearing partially opened/clipped.
        // With this off, .expand() is capped at the highest fixed snap point
        // (70%), so any consumer whose content can exceed that MUST pass
        // `scrollable` — it won't auto-grow past 70% anymore.
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 40, height: 4 }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        )}
        {...rest}
        // Placed after `{...rest}` so a stray `index` in a spread `rest`
        // can never accidentally override this -- the only sanctioned way
        // to start a sheet non-closed is the explicit `initialIndex` prop
        // above, not a generic passthrough prop.
        index={initialIndex}
      >
        {scrollable ? (
          <BottomSheetScrollView
            contentContainerStyle={[styles.contentContainer, contentPadding]}
            keyboardShouldPersistTaps="handled"
          >
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

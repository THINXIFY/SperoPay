import React, { forwardRef, Fragment } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface AppActionSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  title?: string;
  actions: ActionSheetItem[];
  // See AppBottomSheet's identical prop for the full rationale -- the only
  // sanctioned way to have a freshly (lazily) mounted sheet open
  // immediately; every subsequent open/close goes through the ref.
  initialIndex?: number;
}

// The app's branded replacement for a native Alert.alert-based action menu
// (Edit/Duplicate/Archive/Delete-style overflow menus) -- a native alert
// can't be restyled at all (plain OS white, no brand color, no icons), so
// "make it look premium and branded" isn't achievable by tweaking one; this
// renders the same kind of choice as a themed bottom sheet instead.
// Non-destructive actions group into one rounded card; destructive ones
// (Delete) get their own separated card below so they never sit flush
// against an ordinary action. No explicit Cancel row: dismissing via
// backdrop tap or swipe-down is this app's existing convention for every
// other bottom sheet (see AppBottomSheet), so a bespoke Cancel button here
// would be the inconsistent choice, not the missing one.
export const AppActionSheet = forwardRef<BottomSheet, AppActionSheetProps>(
  ({ title, actions, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();
    const regularActions = actions.filter((action) => !action.destructive);
    const destructiveActions = actions.filter((action) => action.destructive);

    function renderGroup(items: ActionSheetItem[]) {
      return (
        <View style={[styles.group, { backgroundColor: colors.background, borderRadius: radius.lg }]}>
          {items.map((action, index) => (
            <Fragment key={action.key}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <Pressable
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.row,
                  { paddingVertical: spacing.base, paddingHorizontal: spacing.base, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
                ]}
              >
                {action.icon ? (
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={action.destructive ? colors.error : colors.textSecondary}
                    style={{ marginRight: spacing.sm }}
                  />
                ) : null}
                <Text style={[typography.body, { color: action.destructive ? colors.error : colors.textPrimary, flex: 1 }]}>
                  {action.label}
                </Text>
              </Pressable>
            </Fragment>
          ))}
        </View>
      );
    }

    return (
      <BottomSheet
        ref={ref}
        // Deliberately no fixed snapPoints, unlike every other sheet in this
        // app -- a menu's height genuinely varies with how many actions it
        // has (2 for Restore/Delete, 4 for Edit/Duplicate/Archive/Delete),
        // and a static percentage either clips a longer menu or leaves a
        // large empty gap under a short one. Gorhom v5's dynamic sizing
        // (the default when enableDynamicSizing isn't set to false, unlike
        // AppBottomSheet's forms/lists which need a fixed height) measures
        // the actual rendered content and sizes to exactly that.
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 40, height: 4 }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        )}
        {...rest}
        index={initialIndex}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.xl }}>
          {title ? (
            <Text
              style={[typography.bodyMedium, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {regularActions.length > 0 ? renderGroup(regularActions) : null}
          {destructiveActions.length > 0 ? (
            <View style={{ marginTop: regularActions.length > 0 ? spacing.md : 0 }}>{renderGroup(destructiveActions)}</View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
AppActionSheet.displayName = 'AppActionSheet';

const styles = StyleSheet.create({
  group: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

import React, { forwardRef, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { searchCountries, type Country } from '../utils/countries';

// A fixed, tall snap point -- unlike AppBottomSheet's 40%/70% default, a
// 250-row searchable list needs real space to be usable, not a partial
// reveal. Hoisted to module scope so this array keeps a stable identity
// across renders (gorhom re-diffs snapPoints by reference/value).
const SNAP_POINTS = ['82%'];

interface CountrySelectSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  selectedCode?: string;
  onSelect: (country: Country) => void;
  // See AppBottomSheet's identical prop for the full rationale: the only
  // sanctioned way to have a freshly (lazily) mounted sheet open
  // immediately -- every subsequent open/close goes through the ref.
  initialIndex?: number;
}

// Self-contained rather than built on AppBottomSheet: this is the one sheet
// in the app that needs a real virtualized list (BottomSheetFlatList) for
// ~250 rows, which AppBottomSheet's BottomSheetView/BottomSheetScrollView
// content modes don't support. Styled to match AppBottomSheet's visual
// conventions exactly (surface background, border-colored handle, 0.5
// backdrop) so it doesn't read as a different component.
export const CountrySelectSheet = forwardRef<BottomSheet, CountrySelectSheetProps>(
  ({ selectedCode, onSelect, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();
    const [query, setQuery] = useState('');
    const results = useMemo(() => searchCountries(query), [query]);

    return (
      <BottomSheet
        ref={ref}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 40, height: 4 }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        )}
        {...rest}
        index={initialIndex}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.base }}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
            Select country
          </Text>
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
              accessibilityLabel="Search countries"
            />
          </View>
          <BottomSheetFlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <Text style={[typography.bodySmall, { color: colors.textMuted, paddingVertical: spacing.md }]}>
                {`No countries match "${query}".`}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = item.code === selectedCode;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: selected ? colors.softMint : 'transparent',
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.base,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text
                    style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </BottomSheet>
    );
  }
);
CountrySelectSheet.displayName = 'CountrySelectSheet';

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  flag: { fontSize: 20 },
});

import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useAuthStore } from '../../../src/store/authStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidEmail } from '../../../src/utils/validators';

export default function CustomersScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const status = useCustomerStore((state) => state.status);
  const error = useCustomerStore((state) => state.error);
  const requests = useRequestStore((state) => state.requests);
  const userId = useAuthStore((state) => state.user?.id);

  const sheetRef = useRef<BottomSheet>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.company].some((value) => value?.toLowerCase().includes(trimmedQuery))
    );
  }, [customers, query]);

  async function handleAdd() {
    const nextNameError = name.trim().length === 0 ? 'Enter a name' : undefined;
    const nextEmailError = !isValidEmail(email) ? 'Enter a valid email' : undefined;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    if (nextNameError || nextEmailError || !userId) return;

    try {
      await addCustomer(userId, { name: name.trim(), email: email.trim(), company: company.trim() || undefined });
      setName('');
      setEmail('');
      setCompany('');
      setNameError(undefined);
      setEmailError(undefined);
      sheetRef.current?.close();
    } catch {
      // addCustomer already set a calm store-level error; the bottom sheet
      // stays open with the entered values intact so the user can retry.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.xl, paddingTop: spacing.md }]}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Customers</Text>
        <Pressable
          onPress={() => sheetRef.current?.expand()}
          style={[styles.addButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Add customer"
        >
          <Ionicons name="add" size={22} color={colors.primaryActionText} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.base },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
            accessibilityLabel="Search customers"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.base }}
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator color={colors.primaryAction} style={{ marginTop: spacing.xl }} />
          ) : status === 'error' ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load customers"
              description={error ?? 'Something went wrong. Pull to refresh or try again.'}
            />
          ) : (
            <EmptyState
              icon="people-outline"
              title={query.length > 0 ? 'No matching customers' : 'No customers yet'}
              description={
                query.length > 0 ? 'Try a different search term.' : 'Add a customer to start requesting payments from them.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const stats = getCustomerStats(item.id, requests);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/(app)/customers/${item.id}`)}>
              <CustomerAvatar name={item.name} color={item.avatarColor} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{item.company || item.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {stats.totalRequests} {stats.totalRequests === 1 ? 'Request' : 'Requests'}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(stats.totalReceived)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <AppBottomSheet ref={sheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add Customer</Text>
        <TextField label="Name" value={name} onChangeText={setName} error={nameError} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
        />
        <TextField label="Company (Optional)" value={company} onChangeText={setCompany} />
        <PrimaryButton label="Add Customer" onPress={handleAdd} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

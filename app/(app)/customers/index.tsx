import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { CustomerImagePicker } from '../../../src/components/CustomerImagePicker';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useCustomerImageEditor } from '../../../src/hooks/useCustomerImageEditor';
import { uploadCustomerAvatar, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { getCustomerStats, type CustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidEmail } from '../../../src/utils/validators';
import type { Customer } from '../../../src/types';

const EMPTY_STATS: CustomerStats = { totalRequests: 0, totalReceived: 0, outstanding: 0 };

interface CustomerRowProps {
  customer: Customer;
  stats: CustomerStats;
  onPress: (id: string) => void;
}

const CustomerRow = React.memo(function CustomerRow({ customer, stats, onPress }: CustomerRowProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 }]}
      onPress={() => onPress(customer.id)}
    >
      <CustomerAvatar
        name={customer.name}
        color={customer.avatarColor}
        avatarUrl={customer.avatarUrl}
        imageType={customer.imageType}
        size={32}
      />
      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
          {customer.company || customer.email}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {stats.totalRequests} {stats.totalRequests === 1 ? 'payment' : 'payments'}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
          {formatCurrency(stats.totalReceived)}
        </Text>
      </View>
    </Pressable>
  );
});

export default function CustomersScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const status = useCustomerStore((state) => state.status);
  const error = useCustomerStore((state) => state.error);
  const requests = useRequestStore((state) => state.requests);
  const userId = useAuthStore((state) => state.user?.id);

  const sheetRef = useRef<BottomSheet>(null);

  // Not rendered at all until first opened -- see request/amount.tsx for
  // why this is the correct fix (not a reactive close-after-the-fact):
  // gorhom's imperative .expand() silently no-ops if called before native
  // layout resolves, which an always-mounted sheet's first .expand() call
  // can race. AppBottomSheet's `initialIndex` prop is the layout-aware,
  // declarative alternative used on first mount below.
  const [isSheetMounted, setIsSheetMounted] = useState(false);

  function openAddCustomerSheet() {
    if (isSheetMounted) {
      sheetRef.current?.expand();
    } else {
      setIsSheetMounted(true);
    }
  }

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      sheetRef.current?.forceClose();
    }, [])
  );

  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const newCustomerImage = useCustomerImageEditor({});

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.company].some((value) => value?.toLowerCase().includes(trimmedQuery))
    );
  }, [customers, query]);

  // Precomputed once per customers/requests change instead of re-running
  // getCustomerStats's O(requests.length) scan inside renderItem on every
  // row on every render.
  const statsById = useMemo(() => {
    const map = new Map<string, CustomerStats>();
    for (const customer of customers) {
      map.set(customer.id, getCustomerStats(customer.id, requests));
    }
    return map;
  }, [customers, requests]);

  const handleRowPress = useCallback((id: string) => {
    router.push(`/(app)/customers/${id}`);
  }, []);

  const renderCustomerRow = useCallback(
    ({ item }: { item: Customer }) => (
      <CustomerRow customer={item} stats={statsById.get(item.id) ?? EMPTY_STATS} onPress={handleRowPress} />
    ),
    [statsById, handleRowPress]
  );

  async function handleAdd() {
    if (isAdding) return;
    const nextNameError = name.trim().length === 0 ? 'Enter a name' : undefined;
    const nextEmailError = !isValidEmail(email) ? 'Enter a valid email' : undefined;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    if (nextNameError || nextEmailError || !userId) return;

    setIsAdding(true);
    try {
      const customer = await addCustomer(userId, {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
      });
      // The Storage path is customers/<owner>/<customer-id>/... , so the
      // customer has to exist (and have an id) before an image can be
      // uploaded for it -- upload is a deliberate follow-up write, not
      // part of the initial insert.
      if (newCustomerImage.localUri) {
        let uploadedButUnsavedUrl: string | undefined;
        try {
          const avatarUrl = await uploadCustomerAvatar(userId, customer.id, newCustomerImage.localUri);
          uploadedButUnsavedUrl = avatarUrl;
          await updateCustomer(userId, customer.id, { avatarUrl, imageType: newCustomerImage.imageType });
        } catch {
          // The customer itself was created successfully -- a failed image
          // upload/save shouldn't look like the whole save failed. They can
          // add a photo afterward from the customer's detail screen. If the
          // upload itself succeeded but the row update meant to reference
          // it then failed, that object is now orphaned -- clean it up.
          if (uploadedButUnsavedUrl) {
            deleteAvatarByUrl(uploadedButUnsavedUrl);
          }
        }
      }
      setName('');
      setEmail('');
      setCompany('');
      setNameError(undefined);
      setEmailError(undefined);
      newCustomerImage.reset();
      sheetRef.current?.close();
    } catch {
      // addCustomer already set a calm store-level error; the bottom sheet
      // stays open with the entered values intact so the user can retry.
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.xl, paddingTop: spacing.md }]}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Customers</Text>
        <Pressable
          onPress={openAddCustomerSheet}
          style={[styles.addButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Add customer"
          hitSlop={4}
        >
          <Ionicons name="add" size={22} color={colors.primaryActionText} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              marginTop: spacing.base,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
            accessibilityLabel="Search customers"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.base }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <View style={{ marginTop: spacing.sm }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                  <View style={[styles.row, { paddingVertical: spacing.sm }]}>
                    <SkeletonLoader width={32} height={32} style={{ borderRadius: radius.full }} />
                    <View style={{ marginLeft: spacing.md, flex: 1, gap: spacing.xs }}>
                      <SkeletonLoader width="55%" height={14} />
                      <SkeletonLoader width="35%" height={11} />
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                      <SkeletonLoader width={60} height={11} />
                      <SkeletonLoader width={50} height={14} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
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
        renderItem={renderCustomerRow}
      />

      {isSheetMounted ? (
        <AppBottomSheet ref={sheetRef} initialIndex={0} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add Customer</Text>
          <CustomerImagePicker
            name={name}
            avatarColor="blue"
            imageUri={newCustomerImage.displayUri}
            hasImage={newCustomerImage.hasImage}
            imageType={newCustomerImage.imageType}
            onImageTypeChange={newCustomerImage.setImageType}
            onPress={newCustomerImage.handlePress}
          />
          <TextField label="Name" value={name} onChangeText={setName} error={nameError} returnKeyType="next" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            returnKeyType="next"
          />
          <TextField
            label="Company (Optional)"
            value={company}
            onChangeText={setCompany}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <PrimaryButton label="Add Customer" onPress={handleAdd} loading={isAdding} />
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

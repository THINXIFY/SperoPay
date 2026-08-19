import { useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { isValidEmail } from '../../../src/utils/validators';

export default function CustomersScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const requests = useRequestStore((state) => state.requests);

  const sheetRef = useRef<BottomSheet>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  function handleAdd() {
    if (name.trim().length === 0 || !isValidEmail(email)) {
      setError('Enter a name and valid email');
      return;
    }
    addCustomer({ name: name.trim(), email: email.trim() });
    setName('');
    setEmail('');
    setError(undefined);
    sheetRef.current?.close();
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

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.base }}
        renderItem={({ item }) => {
          const stats = getCustomerStats(item.id, requests);
          const totalAmount = stats.totalReceived + stats.outstanding;
          return (
            <View style={styles.row}>
              <CustomerAvatar name={item.name} color={item.avatarColor} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{item.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {stats.totalRequests} {stats.totalRequests === 1 ? 'Request' : 'Requests'}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <AppBottomSheet ref={sheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add Customer</Text>
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={error}
        />
        <PrimaryButton label="Add Customer" onPress={handleAdd} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

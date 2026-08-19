import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '../../src/components/BottomNavigation';

export default function AppTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNavigation {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="request-action" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import BrandTitle from '@/components/BrandTitle';
import LocationSheet from '@/components/LocationSheet';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { LocationProvider } from '@/lib/location-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <LocationProvider>
      <LocationSheet />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme].tint,
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, true),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tasks',
            headerTitle: () => <BrandTitle />,
            headerTitleAlign: 'left',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'checklist', android: 'checklist', web: 'checklist' }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: 'Projects',
            headerTitle: () => <BrandTitle />,
            headerTitleAlign: 'left',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'folder', android: 'folder', web: 'folder' }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
      </Tabs>
    </LocationProvider>
  );
}

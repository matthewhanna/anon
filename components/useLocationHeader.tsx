import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

import BrandTitle from '@/components/BrandTitle';
import { useLocationContext } from '@/lib/location-context';

// Sets the screen header to "Anon — <active location> ▾", tapping the suffix
// opens the shared location sheet. Used by the Tasks and Projects tabs.
export function useLocationHeader() {
  const navigation = useNavigation();
  const { locations, activeLocationId, setPickerOpen } = useLocationContext();
  const name = locations.find((l) => l.id === activeLocationId)?.name ?? null;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <BrandTitle suffix={name} onPress={() => setPickerOpen(true)} />,
    });
  }, [navigation, name, setPickerOpen]);
}

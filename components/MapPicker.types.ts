import type { StyleProp, ViewStyle } from 'react-native';

import type { Coords } from '@/lib/location';

export type MapPickerHandle = { centerOn: (c: Coords) => void };

export type MapPickerProps = {
  point: Coords | null;
  radiusM: number;
  strokeColor: string;
  onPointChange: (c: Coords) => void;
  style?: StyleProp<ViewStyle>;
};

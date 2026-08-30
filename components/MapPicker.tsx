import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import type { Coords } from '@/lib/location';
import type { MapPickerHandle, MapPickerProps } from '@/components/MapPicker.types';

const FALLBACK_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 60,
  longitudeDelta: 60,
};

function regionAround(c: Coords, radiusM: number): Region {
  const delta = Math.max(0.004, (radiusM / 111_000) * 6);
  return { latitude: c.latitude, longitude: c.longitude, latitudeDelta: delta, longitudeDelta: delta };
}

const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(function MapPicker(
  { point, radiusM, strokeColor, onPointChange, style },
  ref
) {
  const mapRef = useRef<MapView>(null);
  const [initialRegion] = useState<Region>(() =>
    point ? regionAround(point, radiusM) : FALLBACK_REGION
  );

  useImperativeHandle(
    ref,
    () => ({
      centerOn: (c) => mapRef.current?.animateToRegion(regionAround(c, radiusM), 350),
    }),
    [radiusM]
  );

  return (
    <MapView
      ref={mapRef}
      style={style}
      initialRegion={initialRegion}
      onPress={(e) => onPointChange(e.nativeEvent.coordinate)}>
      {point ? (
        <Marker
          draggable
          coordinate={point}
          onDragEnd={(e) => onPointChange(e.nativeEvent.coordinate)}
        />
      ) : null}
      {point ? (
        <Circle center={point} radius={radiusM} strokeColor={strokeColor} fillColor={`${strokeColor}22`} />
      ) : null}
    </MapView>
  );
});

export default MapPicker;

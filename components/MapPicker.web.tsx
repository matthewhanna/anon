import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import type { MapPickerHandle, MapPickerProps } from '@/components/MapPicker.types';

// Web map via Leaflet + OpenStreetMap tiles (no API key). Tap to move the
// point; the radius circle is shown but only editable on the phone.
const DEFAULT_CENTER: [number, number] = [39.5, -98.35];

const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(function MapPicker(
  { point, radiusM, strokeColor, onPointChange, style },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onPointChange);
  onChangeRef.current = onPointChange;

  useImperativeHandle(
    ref,
    () => ({
      centerOn: (c) => mapRef.current?.setView([c.latitude, c.longitude], 15),
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: point ? [point.latitude, point.longitude] : DEFAULT_CENTER,
      zoom: point ? 15 : 4,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    const latlng: [number, number] = [point.latitude, point.longitude];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latlng, {
        radius: 6,
        color: strokeColor,
        fillColor: strokeColor,
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, {
        radius: radiusM,
        color: strokeColor,
        fillColor: strokeColor,
        fillOpacity: 0.13,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(radiusM);
    }
  }, [point?.latitude, point?.longitude, radiusM, strokeColor]);

  return <View ref={containerRef as never} style={[{ flexGrow: 1, minHeight: 200 }, style]} />;
});

export default MapPicker;

'use client';

/**
 * Basit Leaflet konum seçici — haritaya tıklayarak marker (lat/lng) belirler;
 * radius modunda yarıçap dairesi gösterir. SSR güvenli değildir (window'a
 * bağımlı), bu yüzden tüketici `next/dynamic` ile `ssr:false` yüklemelidir.
 *
 * react-leaflet + leaflet zaten CMS bağımlılıkları (package.json). Varsayılan
 * marker ikonu Next bundler ile bozulduğundan CDN ile sabitlenir.
 */

import { useEffect } from 'react';
import L from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER = [39.925, 32.866]; // Ankara

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function LeafletMapPicker({
  lat,
  lng,
  radiusKm = 0,
  showRadius = false,
  onChange,
}) {
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const center = hasPoint ? [lat, lng] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={hasPoint ? 13 : 6}
      scrollWheelZoom
      className="h-64 w-full rounded-lg border border-border"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={(la, ln) => onChange?.({ lat: la, lng: ln })} />
      {hasPoint && <Recenter lat={lat} lng={lng} />}
      {hasPoint && <Marker position={[lat, lng]} icon={markerIcon} />}
      {hasPoint && showRadius && radiusKm > 0 && (
        <Circle center={[lat, lng]} radius={radiusKm * 1000} />
      )}
    </MapContainer>
  );
}

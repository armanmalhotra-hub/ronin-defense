"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import type { LatLng } from "@/lib/types";

const guessIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#2563eb;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const answerIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#15803d;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function PinMap({
  value,
  onChange,
  disabled,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  disabled?: boolean;
}) {
  return (
    <div className="h-72 rounded-2xl overflow-hidden border border-black/10 relative">
      <MapContainer
        center={[20, 0]}
        zoom={1}
        worldCopyJump
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {!disabled && <ClickHandler onPick={onChange} />}
        {value && <Marker position={[value.lat, value.lng]} icon={guessIcon} />}
      </MapContainer>
      {!value && (
        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
            Tap the map to drop a pin
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultMap({
  guess,
  answer,
}: {
  guess: LatLng | null;
  answer: LatLng;
}) {
  const bounds = useRef<L.LatLngBoundsExpression | null>(null);
  if (guess) {
    bounds.current = [
      [guess.lat, guess.lng],
      [answer.lat, answer.lng],
    ];
  } else {
    bounds.current = [
      [answer.lat - 5, answer.lng - 5],
      [answer.lat + 5, answer.lng + 5],
    ];
  }
  return (
    <div className="h-64 rounded-2xl overflow-hidden border border-black/10">
      <MapContainer
        bounds={bounds.current as L.LatLngBoundsExpression}
        boundsOptions={{ padding: [30, 30] }}
        worldCopyJump
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OSM'
        />
        <Marker position={[answer.lat, answer.lng]} icon={answerIcon} />
        {guess && <Marker position={[guess.lat, guess.lng]} icon={guessIcon} />}
        {guess && (
          <Polyline
            positions={[
              [guess.lat, guess.lng],
              [answer.lat, answer.lng],
            ]}
            pathOptions={{
              color: "#525252",
              weight: 2,
              dashArray: "6 6",
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

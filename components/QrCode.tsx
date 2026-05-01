"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0b132b", light: "#e9d8a6" },
    }).then(setSrc);
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="bg-sand/20 rounded-2xl animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={src}
      alt="Join QR code"
      width={size}
      height={size}
      className="rounded-2xl"
    />
  );
}

"use client";

import dynamic from "next/dynamic";

export const PinMap = dynamic(
  () => import("./PinMap").then((m) => m.PinMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 rounded-2xl bg-black/5 animate-pulse" />
    ),
  },
);

export const ResultMap = dynamic(
  () => import("./PinMap").then((m) => m.ResultMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-2xl bg-black/5 animate-pulse" />
    ),
  },
);

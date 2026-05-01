import { NextResponse } from "next/server";
import { createGame } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const game = createGame();
  return NextResponse.json({
    code: game.code,
    hostToken: game.hostToken,
  });
}

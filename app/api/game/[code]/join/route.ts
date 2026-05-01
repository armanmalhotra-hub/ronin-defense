import { NextResponse } from "next/server";
import { joinGame } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const player = joinGame(params.code, name);
  if (!player) {
    return NextResponse.json(
      { error: "Could not join. Game may not exist or has started." },
      { status: 400 },
    );
  }
  return NextResponse.json({ playerId: player.id, name: player.name });
}

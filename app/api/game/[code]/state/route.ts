import { NextResponse } from "next/server";
import { getGame } from "@/lib/store";
import { toPublicView } from "@/lib/view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const game = getGame(params.code);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicView(game));
}

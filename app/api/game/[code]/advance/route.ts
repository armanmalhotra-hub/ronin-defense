import { NextResponse } from "next/server";
import { advance } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  const body = await req.json().catch(() => ({}));
  const hostToken = typeof body.hostToken === "string" ? body.hostToken : "";
  const game = advance(params.code, hostToken);
  if (!game) {
    return NextResponse.json({ error: "Cannot advance" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, phase: game.phase });
}

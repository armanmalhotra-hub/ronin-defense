import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  const body = await req.json().catch(() => ({}));
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const value = body.value;
  if (!playerId || (typeof value !== "string" && typeof value !== "number")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ok = submitAnswer(params.code, playerId, value);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not submit answer." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

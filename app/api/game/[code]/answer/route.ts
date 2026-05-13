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
  if (!playerId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const guess = body.guess && typeof body.guess === "object"
    ? { lat: Number(body.guess.lat), lng: Number(body.guess.lng) }
    : null;
  if (guess && (!Number.isFinite(guess.lat) || !Number.isFinite(guess.lng))) {
    return NextResponse.json({ error: "Invalid guess coords" }, { status: 400 });
  }
  const number = typeof body.number === "number" ? body.number : null;
  const choiceIndex =
    typeof body.choiceIndex === "number" ? body.choiceIndex : null;
  const binaryValue =
    typeof body.binaryValue === "string" ? body.binaryValue : null;

  const ok = submitAnswer(params.code, playerId, {
    guess,
    number,
    choiceIndex,
    binaryValue,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Could not submit answer." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

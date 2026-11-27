import { NextResponse } from "next/server";
import { createGame } from "@/server/games";
import { getStore } from "@/server/store";
import { handle } from "./respond";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await createGame(getStore(), body.name));
  });
}

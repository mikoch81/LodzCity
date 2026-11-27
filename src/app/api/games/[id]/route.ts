import { NextResponse } from "next/server";
import { HttpError, joinGame, move, startGame, view } from "@/server/games";
import { getStore } from "@/server/store";
import { handle } from "../respond";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const row = await getStore().get(id);
    if (!row) throw new HttpError(404, "Nie ma takiej gry.");
    return NextResponse.json(view(row, req.headers.get("x-token")));
  });
}

// One endpoint for every change: { op: "join" | "start" | "move", ... }
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const token = req.headers.get("x-token");
    const body = await req.json().catch(() => ({}));
    const store = getStore();
    if (body.op === "join") return NextResponse.json(await joinGame(store, id, body.name));
    if (body.op === "start") await startGame(store, id, token, body.bots, body.level);
    else if (body.op === "move") await move(store, id, token, body.action);
    else throw new HttpError(400, "Nieznana operacja.");
    return NextResponse.json(view((await store.get(id))!, token));
  });
}

import { NextResponse } from "next/server";
import { HttpError } from "@/server/games";

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Błąd serwera. Spróbuj ponownie." }, { status: 500 });
  }
}

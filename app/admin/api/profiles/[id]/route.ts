import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ error: "This endpoint is not used by the tax advisor frontend." }, { status: 410 });
}

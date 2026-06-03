// Removed. TVmaze functionality is no longer used.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "TVmaze support has been removed" }, { status: 410 });
}

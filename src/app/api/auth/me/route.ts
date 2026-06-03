import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }
    
    return NextResponse.json({ authenticated: true, user });
  } catch (error: any) {
    console.error("[AUTH ME ERROR]", error);
    return NextResponse.json({ error: "Failed to authenticate session" }, { status: 500 });
  }
}

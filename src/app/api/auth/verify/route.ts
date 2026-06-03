import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/?verify_error=missing_token", request.url));
    }

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Find the user with this verification token
    const user = await db.collection("users").findOne({
      verification_token: token,
      verification_token_expires: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.redirect(new URL("/?verify_error=invalid_or_expired_token", request.url));
    }

    // Update user to verified
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: { is_verified: true },
        $unset: { verification_token: "", verification_token_expires: "" }
      }
    );

    // Redirect to home page with verified flag
    return NextResponse.redirect(new URL("/?verified=true", request.url));

  } catch (error: any) {
    console.error("[VERIFY ERROR]", error);
    return NextResponse.redirect(new URL("/?verify_error=server_error", request.url));
  }
}

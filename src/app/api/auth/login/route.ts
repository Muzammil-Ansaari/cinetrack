import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { comparePassword, signJWT } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Find user
    const user = await db.collection("users").findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify password
    const isPasswordCorrect = await comparePassword(password, user.password);
    if (!isPasswordCorrect) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Check if verified
    if (!user.is_verified) {
      return NextResponse.json({
        error: "Your email address is not verified. Please verify your email before logging in.",
        notVerified: true,
        email: user.email
      }, { status: 403 });
    }

    // Generate JWT
    const payload = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role || "user"
    };

    const token = signJWT(payload);

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        display_name: user.display_name || user.username,
        avatar_color: user.avatar_color,
        role: user.role || "user",
        is_verified: true,
        created_at: user.created_at
      }
    });

    response.cookies.set({
      name: "cinetrack_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: "/"
    });

    return response;

  } catch (error: any) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during login" }, { status: 500 });
  }
}

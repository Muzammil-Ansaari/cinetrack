import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Find the user with this token and verify token is not expired
    const user = await db.collection("users").findOne({
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json({ error: "The password reset link is invalid or has expired." }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update the password in database and clear the token fields
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { reset_password_token: "", reset_password_expires: "" }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Password reset successful! You can now log in with your new password."
    });

  } catch (error: any) {
    console.error("[RESET PASSWORD ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 500 });
  }
}

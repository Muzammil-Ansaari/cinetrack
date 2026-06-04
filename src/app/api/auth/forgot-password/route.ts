import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { sendResetEmail } from "@/lib/auth";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Find the user with this email
    const user = await db.collection("users").findOne({ email: cleanEmail });

    // For security reasons, don't explicitly say if email exists or not.
    // Always return a success response to avoid email enumeration.
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a reset link has been sent."
      });
    }

    // Generate secure random reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour expiration

    // Save token and expiration date to the user record
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          reset_password_token: token,
          reset_password_expires: expires
        }
      }
    );

    // Send the password reset email
    await sendResetEmail(user.email, user.username, token);

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent."
    });

  } catch (error: any) {
    console.error("[FORGOT PASSWORD ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to process forgot password request" }, { status: 500 });
  }
}

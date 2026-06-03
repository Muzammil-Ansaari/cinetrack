import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { hashPassword, sendVerificationEmail } from "@/lib/auth";
import crypto from "crypto";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, display_name } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: "Missing required fields: email, password, username" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();

    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: "Username can only contain lowercase letters, numbers, and underscores" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({
      $or: [
        { email: cleanEmail },
        { username: cleanUsername }
      ]
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    // Determine role (first user is superadmin)
    const userCount = await db.collection("users").countDocuments();
    const role = userCount === 0 ? "superadmin" : "user";

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const hashedPassword = await hashPassword(password);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newUser = {
      email: cleanEmail,
      username: cleanUsername,
      display_name: display_name ? display_name.trim() : cleanUsername,
      password: hashedPassword,
      avatar_color: avatarColor,
      role,
      is_verified: false,
      verification_token: verificationToken,
      verification_token_expires: verificationTokenExpires,
      created_at: new Date()
    };

    const result = await db.collection("users").insertOne(newUser);

    // Send verification email
    await sendVerificationEmail(cleanEmail, cleanUsername, verificationToken);

    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please verify your email.",
      devToken: isDev ? verificationToken : undefined // Expose for easy testing in dev
    }, { status: 201 });

  } catch (error: any) {
    console.error("[SIGNUP ERROR]", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during signup" }, { status: 500 });
  }
}

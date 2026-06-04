import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { NextRequest } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "cinetrack_jwt_secret_key_1234567890_super_secure";

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Sign JWT
export function signJWT(payload: { id: string; email: string; username: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// Verify JWT
export function verifyJWT(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; username: string; role: string };
  } catch (error) {
    return null;
  }
}

// Extract user from request (checking cookies)
export async function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get("cinetrack_token")?.value;
  if (!token) return null;

  const decoded = verifyJWT(token);
  if (!decoded) return null;

  const client = await clientPromise;
  const db = client.db("cinetrack");
  
  // Find user in database
  const user = await db.collection("users").findOne({ _id: new ObjectId(decoded.id) });
  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_color: user.avatar_color,
    role: user.role || "user",
    is_verified: !!user.is_verified,
    created_at: user.created_at
  };
}

// Send verification email
export async function sendVerificationEmail(email: string, username: string, token: string) {
  const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verificationLink = `${domain}/api/auth/verify?token=${token}`;
  console.log(`Sending verification email to: ${email}`);

  // Attempt to use nodemailer if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || "no-reply@cinetrack.com";

  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "Verify your CineTrack Account",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg">
            <h2 style="color: #6366f1;">Welcome to CineTrack!</h2>
            <p>Hi @${username},</p>
            <p>Thanks for signing up to CineTrack. Please verify your email address by clicking the button below:</p>
            <div style="margin: 24px 0;">
              <a href="${verificationLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4b5563;">${verificationLink}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #9ca3af;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
      console.log(`Nodemailer sent email successfully to ${email}`);
    } catch (error) {
      console.error("Nodemailer failed to send email, fell back to server log. Error:", error);
    }
  }
}

// Send password reset email
export async function sendResetEmail(email: string, username: string, token: string) {
  const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${domain}/?reset_token=${token}`;
  console.log(`Sending password reset email to: ${email}`);

  // Attempt to use nodemailer if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || "no-reply@cinetrack.com";

  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "Reset your CineTrack Password",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #8b5cf6;">Reset your CineTrack Password</h2>
            <p>Hi @${username},</p>
            <p>We received a request to reset your password. Please click the button below to choose a new password:</p>
            <div style="margin: 24px 0;">
              <a href="${resetLink}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4b5563;">${resetLink}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
      console.log(`Nodemailer sent reset email successfully to ${email}`);
    } catch (error) {
      console.error("Nodemailer failed to send reset email, fell back to server log. Error:", error);
    }
  }
}

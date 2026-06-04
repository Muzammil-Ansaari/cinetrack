import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getUserFromRequest, comparePassword, hashPassword } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { display_name, avatar_color, current_password, new_password } = await request.json();

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Fetch full user record including password hash
    const userDoc = await db.collection("users").findOne({ _id: new ObjectId(currentUser.id) });
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateFields: any = {};

    // 1. Update Display Name if provided
    if (display_name !== undefined) {
      const cleanName = display_name.trim();
      if (cleanName.length === 0) {
        return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
      }
      if (cleanName.length > 50) {
        return NextResponse.json({ error: "Display name is too long" }, { status: 400 });
      }
      updateFields.display_name = cleanName;
    }

    // 2. Update Avatar Color if provided
    if (avatar_color !== undefined) {
      const cleanColor = avatar_color.trim();
      if (!/^#[0-9A-F]{6}$/i.test(cleanColor)) {
        return NextResponse.json({ error: "Invalid avatar color format (must be #RRGGBB)" }, { status: 400 });
      }
      updateFields.avatar_color = cleanColor;
    }

    // 3. Update Password if provided
    if (new_password !== undefined) {
      if (!current_password) {
        return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
      }
      if (new_password.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters long" }, { status: 400 });
      }

      // Check current password correctness
      const isPasswordCorrect = await comparePassword(current_password, userDoc.password);
      if (!isPasswordCorrect) {
        return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
      }

      // Hash the new password
      updateFields.password = await hashPassword(new_password);
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Perform database update
    await db.collection("users").updateOne(
      { _id: new ObjectId(currentUser.id) },
      { $set: updateFields }
    );

    // Retrieve updated user details (excluding hashed password)
    const updatedUser = {
      id: currentUser.id,
      email: currentUser.email,
      username: currentUser.username,
      display_name: updateFields.display_name || userDoc.display_name || userDoc.username,
      avatar_color: updateFields.avatar_color || userDoc.avatar_color,
      role: userDoc.role || "user",
      is_verified: !!userDoc.is_verified,
      created_at: userDoc.created_at
    };

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (error: any) {
    console.error("[PUT PROFILE ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update profile settings" }, { status: 500 });
  }
}

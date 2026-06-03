import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ObjectId } from "mongodb";

// GET: Search users (for adding friends) or List users (for Admin panel)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const listAll = searchParams.get("listAll") === "true";

    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Admin Panel request
    if (listAll) {
      if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
        return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 });
      }

      // Return all users with detailed fields
      const usersList = await db.collection("users")
        .find({})
        .sort({ created_at: -1 })
        .toArray();

      const formatted = usersList.map((u: any) => ({
        id: u._id.toString(),
        email: u.email,
        username: u.username,
        display_name: u.display_name || u.username,
        avatar_color: u.avatar_color,
        role: u.role || "user",
        is_verified: !!u.is_verified,
        created_at: u.created_at
      }));

      return NextResponse.json({ results: formatted });
    }

    // Standard User Search request
    if (search) {
      const cleanSearch = search.toLowerCase().trim();
      if (cleanSearch.length < 2) {
        return NextResponse.json({ results: [] });
      }

      const matchingUsers = await db.collection("users")
        .find({
          username: { $regex: cleanSearch, $options: "i" },
          _id: { $ne: new ObjectId(currentUser.id) } // Exclude current user
        })
        .limit(10)
        .toArray();

      const formatted = matchingUsers.map((u: any) => ({
        id: u._id.toString(),
        username: u.username,
        display_name: u.display_name || u.username,
        avatar_color: u.avatar_color
      }));

      return NextResponse.json({ results: formatted });
    }

    // Default to search or list profile of another user
    const userId = searchParams.get("userId");
    if (userId) {
      const u = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      if (!u) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({
        id: u._id.toString(),
        username: u.username,
        display_name: u.display_name || u.username,
        avatar_color: u.avatar_color
      });
    }

    return NextResponse.json({ error: "Query parameter 'search', 'userId', or 'listAll=true' is required" }, { status: 400 });

  } catch (error: any) {
    console.error("[GET USERS ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to query users" }, { status: 500 });
  }
}

// PUT: Admin/Superadmin updates user details (role or verification status)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin rights
    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 });
    }

    const { userId, role, is_verified } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cinetrack");

    const targetUser = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Security constraints:
    // 1. Admins cannot change superadmin properties
    if (targetUser.role === "superadmin" && currentUser.id !== userId) {
      return NextResponse.json({ error: "Only the Superadmin can modify their own account." }, { status: 403 });
    }

    // 2. Only superadmin can promote someone to admin or superadmin
    if (role && role !== targetUser.role && currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "Only the Superadmin can modify user roles." }, { status: 403 });
    }

    // 3. Superadmin cannot demote themselves if they are the only one
    if (userId === currentUser.id && role && role !== "superadmin") {
      return NextResponse.json({ error: "You cannot demote yourself from Superadmin." }, { status: 400 });
    }

    const updateFields: any = {};
    if (role !== undefined) updateFields.role = role;
    if (is_verified !== undefined) updateFields.is_verified = is_verified;

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    return NextResponse.json({ success: true, message: "User updated successfully" });

  } catch (error: any) {
    console.error("[PUT USER ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

// DELETE: Admin/Superadmin deletes a user
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin rights
    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cinetrack");

    const targetUser = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Security: Admins cannot delete the superadmin or other admins
    if (currentUser.role === "admin" && (targetUser.role === "superadmin" || targetUser.role === "admin")) {
      return NextResponse.json({ error: "Admins cannot delete other Admins or the Superadmin." }, { status: 403 });
    }

    // Delete user from users, and clean up their movies, friendships, and activities!
    // 1. Delete user record
    await db.collection("users").deleteOne({ _id: new ObjectId(userId) });

    // 2. Delete user's movies
    await db.collection("movies").deleteMany({ user_id: userId });

    // 3. Delete friendships involving the user
    await db.collection("friendships").deleteMany({
      $or: [
        { requester_id: userId },
        { addressee_id: userId }
      ]
    });

    // 4. Delete activities by this user
    await db.collection("activities").deleteMany({ user_id: userId });

    return NextResponse.json({ success: true, message: "User and all associated data deleted successfully" });

  } catch (error: any) {
    console.error("[DELETE USER ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}

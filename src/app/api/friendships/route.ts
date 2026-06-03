import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ObjectId } from "mongodb";

// Helper to get collections
async function getCollections() {
  const client = await clientPromise;
  const db = client.db("cinetrack");
  return {
    friendships: db.collection("friendships"),
    users: db.collection("users")
  };
}

// 1. GET: Fetch friendships and pending requests for the logged-in user
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { friendships, users } = await getCollections();
    const currentUserId = currentUser.id;

    // Fetch friendships involving current user
    const list = await friendships.find({
      $or: [
        { requester_id: currentUserId },
        { addressee_id: currentUserId }
      ]
    }).toArray();

    // Map friendship documents with user profile information
    const formattedList = [];
    for (const friendship of list) {
      const isRequester = friendship.requester_id === currentUserId;
      const otherUserId = isRequester ? friendship.addressee_id : friendship.requester_id;

      let otherUserObj = null;
      try {
        const u = await users.findOne({ _id: new ObjectId(otherUserId) });
        if (u) {
          otherUserObj = {
            id: u._id.toString(),
            username: u.username,
            display_name: u.display_name || u.username,
            avatar_color: u.avatar_color,
            created_at: u.created_at
          };
        }
      } catch (err) {
        console.error("Error fetching friend user details:", err);
      }

      // Also get requester profile for pending requests sent to me
      let requesterObj = null;
      if (!isRequester) {
        try {
          const u = await users.findOne({ _id: new ObjectId(friendship.requester_id) });
          if (u) {
            requesterObj = {
              id: u._id.toString(),
              username: u.username,
              display_name: u.display_name || u.username,
              avatar_color: u.avatar_color,
              created_at: u.created_at
            };
          }
        } catch (err) {}
      }

      // Get addressee profile for completeness
      let addresseeObj = null;
      if (isRequester) {
        addresseeObj = otherUserObj;
      } else {
        try {
          const u = await users.findOne({ _id: new ObjectId(friendship.addressee_id) });
          if (u) {
            addresseeObj = {
              id: u._id.toString(),
              username: u.username,
              display_name: u.display_name || u.username,
              avatar_color: u.avatar_color,
              created_at: u.created_at
            };
          }
        } catch (err) {}
      }

      formattedList.push({
        id: friendship._id.toString(),
        requester_id: friendship.requester_id,
        addressee_id: friendship.addressee_id,
        status: friendship.status,
        merge_status: friendship.merge_status || "none",
        merge_requester_id: friendship.merge_requester_id || null,
        created_at: friendship.created_at,
        requester: requesterObj || { id: friendship.requester_id, username: "", display_name: "", avatar_color: "" },
        addressee: addresseeObj || { id: friendship.addressee_id, username: "", display_name: "", avatar_color: "" }
      });
    }

    return NextResponse.json({ results: formattedList });
  } catch (error: any) {
    console.error("[GET FRIENDSHIPS ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to fetch friendships" }, { status: 500 });
  }
}

// 2. POST: Send a friend request (takes username in body)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername === currentUser.username.toLowerCase()) {
      return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
    }

    const { friendships, users } = await getCollections();

    // Find target user by username
    const targetUser = await users.findOne({ username: cleanUsername });
    if (!targetUser) {
      return NextResponse.json({ error: `No user found with username "@${username}".` }, { status: 404 });
    }

    const currentUserId = currentUser.id;
    const targetUserId = targetUser._id.toString();

    // Check if friendship already exists
    const existing = await friendships.findOne({
      $or: [
        { requester_id: currentUserId, addressee_id: targetUserId },
        { requester_id: targetUserId, addressee_id: currentUserId }
      ]
    });

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "You are already friends!" }, { status: 400 });
      }
      if (existing.status === "pending") {
        return NextResponse.json({ error: "A friend request already exists." }, { status: 400 });
      }
    }

    // Insert friendship record
    const result = await friendships.insertOne({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: "pending",
      merge_status: "none",
      merge_requester_id: null,
      created_at: new Date()
    });

    return NextResponse.json({ success: true, insertedId: result.insertedId });
  } catch (error: any) {
    console.error("[POST FRIENDSHIP ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create friend request" }, { status: 500 });
  }
}

// 3. PUT: Update friendship status or merge lists status
// Takes friendshipId and action
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { friendshipId, friendProfileId, action } = await request.json();
    const { friendships } = await getCollections();
    const currentUserId = currentUser.id;

    let filter: any = {};
    if (friendshipId) {
      filter = { _id: new ObjectId(friendshipId) };
    } else if (friendProfileId) {
      filter = {
        $or: [
          { requester_id: currentUserId, addressee_id: friendProfileId },
          { requester_id: friendProfileId, addressee_id: currentUserId }
        ]
      };
    } else {
      return NextResponse.json({ error: "Missing friendshipId or friendProfileId" }, { status: 400 });
    }

    const friendship = await friendships.findOne(filter);
    if (!friendship) {
      return NextResponse.json({ error: "Friendship record not found" }, { status: 404 });
    }

    // Security check: must be one of the users in friendship
    if (friendship.requester_id !== currentUserId && friendship.addressee_id !== currentUserId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let updateFields: any = {};

    switch (action) {
      case "accept":
        if (friendship.addressee_id !== currentUserId) {
          return NextResponse.json({ error: "Only the addressee can accept the request" }, { status: 403 });
        }
        updateFields = { status: "accepted" };
        break;
      case "reject":
        // Rejecting simply deletes or rejects (we will delete the request)
        await friendships.deleteOne({ _id: friendship._id });
        return NextResponse.json({ success: true, deleted: true });

      case "request_merge":
        updateFields = {
          merge_status: "pending",
          merge_requester_id: currentUserId
        };
        break;
      case "accept_merge":
        updateFields = {
          merge_status: "accepted"
        };
        break;
      case "reject_merge":
        updateFields = {
          merge_status: "none",
          merge_requester_id: null
        };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await friendships.updateOne({ _id: friendship._id }, { $set: updateFields });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[PUT FRIENDSHIP ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update friendship" }, { status: 500 });
  }
}

// 4. DELETE: Remove friend
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendProfileId = searchParams.get("friendProfileId");

    if (!friendProfileId) {
      return NextResponse.json({ error: "friendProfileId parameter is required" }, { status: 400 });
    }

    const { friendships } = await getCollections();
    const currentUserId = currentUser.id;

    const result = await friendships.deleteMany({
      $or: [
        { requester_id: currentUserId, addressee_id: friendProfileId },
        { requester_id: friendProfileId, addressee_id: currentUserId }
      ]
    });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error("[DELETE FRIENDSHIP ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to remove friendship" }, { status: 500 });
  }
}

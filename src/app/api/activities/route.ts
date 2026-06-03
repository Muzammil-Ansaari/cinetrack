import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// Helper to get the MongoDB database and collection
async function getCollection() {
  const client = await clientPromise;
  const db = client.db("cinetrack");
  return db.collection("activities");
}

// 1. GET: Fetch activity logs for the current user and their friends
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdsStr = searchParams.get("userIds");

    if (!userIdsStr) {
      return NextResponse.json({ error: "userIds query parameter is required" }, { status: 400 });
    }

    const userIds = userIdsStr.split(",").map(id => id.trim()).filter(Boolean);
    const collection = await getCollection();

    // Fetch activities from the specified users, sorted by timestamp descending, limit to 50
    const activities = await collection
      .find({ user_id: { $in: userIds } })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    const formatted = activities.map((item: any) => {
      const { _id, ...rest } = item;
      return {
        ...rest,
        id: rest.id || String(_id)
      };
    });

    return NextResponse.json({ results: formatted });
  } catch (error: any) {
    console.error("[MONGODB GET ACTIVITIES ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to fetch activities" }, { status: 500 });
  }
}

// 2. POST: Add a new activity log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const collection = await getCollection();

    // Ensure _id from incoming payload doesn't conflict
    const { _id, ...cleanLog } = body;

    const result = await collection.insertOne({
      ...cleanLog,
      timestamp: cleanLog.timestamp || new Date().toISOString()
    });

    return NextResponse.json({ success: true, insertedId: result.insertedId }, { status: 201 });
  } catch (error: any) {
    console.error("[MONGODB POST ACTIVITY ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to save activity" }, { status: 500 });
  }
}

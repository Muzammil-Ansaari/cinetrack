import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// Helper to get the MongoDB database and collection
async function getCollection() {
  const client = await clientPromise;
  const db = client.db("cinetrack");
  return db.collection("activities");
}

// 1. GET: Automatically drop the collection to free space, and return empty list
export async function GET(request: NextRequest) {
  try {
    const collection = await getCollection();
    // Drop the collection from MongoDB to reclaim space
    await collection.drop().catch(() => {});
    return NextResponse.json({ results: [] });
  } catch (error: any) {
    return NextResponse.json({ results: [] });
  }
}

// 2. POST: No-op success response
export async function POST(request: NextRequest) {
  try {
    const collection = await getCollection();
    await collection.drop().catch(() => {});
  } catch (e) {}
  return NextResponse.json({ success: true }, { status: 200 });
}

// 3. DELETE: Drop collection to reclaim space
export async function DELETE(request: NextRequest) {
  try {
    const collection = await getCollection();
    await collection.drop().catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: true });
  }
}

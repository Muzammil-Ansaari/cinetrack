import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("cinetrack");

    // Delete from movies
    const moviesResult = await db.collection("movies").deleteMany({
      title: { $regex: /one piece/i }
    });

    // Delete from activities
    let activitiesResult = { deletedCount: 0 };
    const collections = await db.listCollections().toArray();
    if (collections.some(c => c.name === "activities")) {
      activitiesResult = await db.collection("activities").deleteMany({
        $or: [
          { movieTitle: { $regex: /one piece/i } },
          { message: { $regex: /one piece/i } }
        ]
      });
    }

    return NextResponse.json({
      success: true,
      moviesDeleted: moviesResult.deletedCount,
      activitiesDeleted: activitiesResult.deletedCount
    });
  } catch (error: any) {
    console.error("Delete One Piece Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}

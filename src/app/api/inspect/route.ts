import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("cinetrack");
    const collection = db.collection("movies");
    const movies = await collection.find({}).toArray();

    const summary = movies.map((m: any) => ({
      id: m.id || String(m._id),
      tmdb_id: m.tmdb_id,
      title: m.title,
      user_id: m.user_id,
      owners: m.owners,
      reviews_json: m.reviews_json,
      watched: m.watched,
      watched_by: m.watched_by,
      declined: m.declined,
      declined_by: m.declined_by,
      created_at: m.created_at
    }));

    return NextResponse.json({ count: summary.length, movies: summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

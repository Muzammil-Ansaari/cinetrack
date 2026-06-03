import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("cinetrack");

    const movies = await db.collection("movies").find({
      title: { $regex: /one piece/i }
    }).toArray();

    return NextResponse.json({
      count: movies.length,
      movies: movies
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

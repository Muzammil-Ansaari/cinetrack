import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: "Missing TMDB key" }, { status: 500 });
    }

    // Search for "One Piece" (first TV result)
    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=One%20Piece`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const show = searchData.results?.[0];

    if (!show) {
      return NextResponse.json({ error: "No show found on TMDB" });
    }

    // Fetch details for the show
    const detailUrl = `https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const details = await detailRes.json();

    return NextResponse.json({
      tmdb_id: show.id,
      name: details.name,
      number_of_seasons: details.number_of_seasons,
      number_of_episodes: details.number_of_episodes,
      seasons: details.seasons
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

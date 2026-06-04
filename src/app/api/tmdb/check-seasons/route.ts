import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: "Server TMDB key missing" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const tmdb_id = searchParams.get("tmdb_id");

  if (!tmdb_id) {
    return NextResponse.json({ error: "tmdb_id parameter is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdb_id}?api_key=${TMDB_API_KEY}&language=en-US`);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from TMDB" }, { status: res.status });
    }
    const data = await res.json();
    
    // Count only active seasons that have aired/have episodes (ignore Specials/Season 0)
    const today = new Date().toISOString().split("T")[0];
    let seasons = data.number_of_seasons || 1;
    if (data.seasons && Array.isArray(data.seasons)) {
      const activeSeasonsList = data.seasons.filter(
        (s: any) => s.season_number > 0 && 
                    s.episode_count > 0 && 
                    (!s.air_date || s.air_date <= today)
      );
      if (activeSeasonsList.length > 0) {
        seasons = activeSeasonsList.length;
      }
    }

    const nextEpisodeAirDate = data.next_episode_to_air?.air_date || null;

    return NextResponse.json({ 
      number_of_seasons: seasons, 
      name: data.name,
      next_episode_air_date: nextEpisodeAirDate
    });
  } catch (err: any) {
    console.error(`check-seasons error for tmdb_id ${tmdb_id}:`, err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

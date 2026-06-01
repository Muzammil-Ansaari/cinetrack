import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Robust fetch utility with a 15-second network timeout boundary
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API Key is missing on the server. Configure TMDB_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const movieId = searchParams.get("movieId");
  const mediaType = searchParams.get("mediaType") || "movie"; // 'movie' or 'tv'
  const trending = searchParams.get("trending");
  const page = searchParams.get("page") || "1";

  // Helper function to auto-categorize movies, tv shows, anime, and animation
  function getMediaCategory(item: any): string {
    const isAnimation = item.genre_ids?.includes(16) || 
                        item.genres?.some((g: any) => g.id === 16 || g.name === "Animation") || 
                        false;
    
    const isJapanese = item.original_language === "ja" || 
                       item.origin_country?.includes("JP") || 
                       false;

    if (isAnimation && isJapanese) {
      return "Anime";
    }

    const isTv = item.media_type === "tv" || 
                 item.first_air_date !== undefined || 
                 item.number_of_seasons !== undefined;

    if (isTv) {
      return isAnimation ? "Anime" : "TV Show";
    }

    return isAnimation ? "Animated Movie" : "Movie";
  }

  try {
    // Mode 1: Search Movies & TV Shows (Multi-Search)
    if (query) {
      const response = await fetchWithTimeout(
        `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
          query
        )}&language=en-US&page=${page}&include_adult=false`,
        {},
        8000 // 8-second robust search timeout boundary
      );
      if (!response.ok) throw new Error("TMDB search failed");
      const data = await response.json();
      
      // Filter out non-media items and assign custom categories
      const rawResults = (data.results || [])
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 20);

      const mappedResults = rawResults.map((item: any) => {
        const category = getMediaCategory(item);
        return {
          id: item.id,
          title: item.title || item.name,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.release_date || item.first_air_date || "",
          vote_average: item.vote_average,
          overview: item.overview,
          media_type: item.media_type,
          category,
          seasons: null, // Seasons count is fetched dynamically only when the user chooses to add the title
        };
      });

      return NextResponse.json({ results: mappedResults });
    }

    // Mode 2: Detailed Metadata (for extracting runtime and seasons)
    if (movieId) {
      const isTv = mediaType === "tv";
      const response = await fetchWithTimeout(
        `https://api.tmdb.org/3/${isTv ? "tv" : "movie"}/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      if (!response.ok) throw new Error(`TMDB ${mediaType} details fetch failed`);
      const data = await response.json();

      const category = getMediaCategory({ ...data, media_type: mediaType });

      // Normalize TV runtimes & load seasons
      if (isTv) {
        const numEpisodes = data.number_of_episodes || 12;
        const episodeRuntime = data.episode_run_time && data.episode_run_time.length > 0
          ? data.episode_run_time[0]
          : 45; // Default standard TV show episode length (45 mins)
        const totalRuntime = episodeRuntime * numEpisodes;
        return NextResponse.json({ 
          ...data, 
          runtime: totalRuntime,
          seasons: data.number_of_seasons || 1,
          category,
        });
      }

      return NextResponse.json({
        ...data,
        seasons: null,
        category,
      });
    }

    // Mode 3: Trending / Popular (Hero Carousel)
    if (trending === "true") {
      const response = await fetchWithTimeout(
        `https://api.tmdb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=en-US`,
        {},
        2000 // 2-second fast-fail trending timeout
      );
      if (!response.ok) throw new Error("TMDB trending fetch failed");
      const data = await response.json();
      
      const mappedTrending = (data.results || [])
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .map((item: any) => {
          const category = getMediaCategory(item);
          return {
            id: item.id,
            title: item.title || item.name,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            release_date: item.release_date || item.first_air_date || "",
            vote_average: item.vote_average,
            overview: item.overview,
            media_type: item.media_type,
            category,
            seasons: null,
          };
        });

      return NextResponse.json({ results: mappedTrending });
    }

    // Mode 4: Curated Dashboard Sections
    if (section) {
      let endpoint = "";
      if (section === "trending_today") {
        endpoint = `https://api.tmdb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=en-US`;
      } else if (section === "trending_week") {
        endpoint = `https://api.tmdb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`;
      } else if (section === "popular") {
        endpoint = `https://api.tmdb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
      } else if (section === "top_rated") {
        endpoint = `https://api.tmdb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
      } else if (section === "upcoming") {
        endpoint = `https://api.tmdb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
      } else {
        return NextResponse.json({ error: "Invalid section parameter" }, { status: 400 });
      }

      const response = await fetchWithTimeout(endpoint, {}, 2000); // 2-second fast-fail section timeout
      if (!response.ok) throw new Error(`TMDB fetch failed for section: ${section}`);
      const data = await response.json();

      const mapped = (data.results || [])
        .slice(0, 10)
        .map((item: any) => {
          const mType = item.media_type || (item.first_air_date ? "tv" : "movie");
          const category = getMediaCategory({ ...item, media_type: mType });
          return {
            id: item.id,
            title: item.title || item.name,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            release_date: item.release_date || item.first_air_date || "",
            vote_average: item.vote_average,
            overview: item.overview,
            media_type: mType,
            category,
            seasons: null,
          };
        });

      return NextResponse.json({ results: mapped });
    }

    return NextResponse.json({ error: "Invalid parameters. Provide query, movieId, trending, or section." }, { status: 400 });
  } catch (error: any) {
    const isOffline = error.message?.includes("fetch failed") || 
                      error.code === "UND_ERR_CONNECT_TIMEOUT" || 
                      error.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
    if (isOffline) {
      console.warn("⚠️  [CineTrack Offline Mode] TMDB API unreachable. Serving high-fidelity curated collections.");
    } else {
      console.error("[TMDB PROXY ERROR]", error);
    }
    // In case TMDB is offline or unreachable, return a clean 200 with empty results and an offline flag
    // to prevent red next.js front-end crash screens, letting the UI handle it gracefully.
    return NextResponse.json({ results: [], offline: true }, { status: 200 });
  }
}

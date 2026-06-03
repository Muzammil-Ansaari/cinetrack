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
  const section = searchParams.get("section");

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
        .slice(0, 12);

      const today = new Date().toISOString().split("T")[0];
      const enrichedResults = await Promise.all(
        rawResults.map(async (item: any) => {
          const category = getMediaCategory(item);
          const isTv = item.media_type === "tv" || item.first_air_date !== undefined;
          
          let seasons = null;
          let episodes = null;
          let runtime = 120;
          
          try {
            const detailUrl = isTv
              ? `https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=en-US`
              : `https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=en-US`;
            
            const detailRes = await fetchWithTimeout(detailUrl, {}, 4000);
            if (detailRes.ok) {
              const details = await detailRes.json();
              if (isTv) {
                let tempSeasons = details.number_of_seasons || 1;
                let tempEpisodes = details.number_of_episodes || 12;
                
                if (details.seasons && Array.isArray(details.seasons)) {
                  // Count only active seasons that have aired/have episodes (ignore Specials/Season 0)
                  const activeSeasonsList = details.seasons.filter(
                    (s: any) => s.season_number > 0 && 
                                s.episode_count > 0 && 
                                (!s.air_date || s.air_date <= today)
                  );
                  
                  if (activeSeasonsList.length > 0) {
                    tempSeasons = activeSeasonsList.length;
                  }
                  
                  const activeEpisodes = activeSeasonsList.reduce((sum: number, s: any) => sum + (s.episode_count || 0), 0);
                  if (activeEpisodes > 0) {
                    tempEpisodes = activeEpisodes;
                  }
                }
                
                seasons = tempSeasons;
                episodes = tempEpisodes;
                
                const epRuntime = details.episode_run_time && details.episode_run_time.length > 0
                  ? details.episode_run_time[0]
                  : 45;
                runtime = epRuntime * tempEpisodes;
              } else {
                runtime = details.runtime || 120;
              }
            }
          } catch (e) {
            console.error(`Failed to enrich TMDB search item ${item.title || item.name}:`, e);
          }
          
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
            seasons,
            episodes,
            runtime,
          };
        })
      );

      return NextResponse.json({ results: enrichedResults });
    }

    // Mode 2: Detailed Metadata (for extracting runtime and seasons)
    if (movieId) {
      const isTv = mediaType === "tv";
      const includeEpisodes = searchParams.get("includeEpisodes") === "true";
      
      const response = await fetchWithTimeout(
        `https://api.tmdb.org/3/${isTv ? "tv" : "movie"}/${movieId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`
      );
      if (!response.ok) throw new Error(`TMDB ${mediaType} details fetch failed`);
      const data = await response.json();

      const category = getMediaCategory({ ...data, media_type: mediaType });
      const videos = data.videos?.results || [];
      const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") || 
                      videos.find((v: any) => v.site === "YouTube") || 
                      null;
      const trailerKey = trailer?.key || null;

      // Normalize TV runtimes & load seasons
      if (isTv) {
        let seasons = data.number_of_seasons || 1;
        let numEpisodes = data.number_of_episodes || 12;
        let seasonsWithEpisodes = null;

        const today = new Date().toISOString().split("T")[0];
        
        // Count only valid, active seasons that have premiered and have episodes (ignore Specials/Season 0)
        const activeSeasonsList = (data.seasons || []).filter(
          (s: any) => s.season_number > 0 && 
                      s.episode_count > 0 && 
                      (!s.air_date || s.air_date <= today)
        );

        if (activeSeasonsList.length > 0) {
          seasons = activeSeasonsList.length;
        }

        // Compute total episodes from active seasons (excluding Specials/Season 0 and future seasons)
        const activeEpisodes = activeSeasonsList.reduce((sum: number, s: any) => sum + (s.episode_count || 0), 0);
        if (activeEpisodes > 0) {
          numEpisodes = activeEpisodes;
        }

        const episodeRuntime = data.episode_run_time && data.episode_run_time.length > 0
          ? data.episode_run_time[0]
          : 45; // Default standard TV show episode length (45 mins)
        const totalRuntime = episodeRuntime * numEpisodes;

        // Parallel fetch episodes list if requested
        if (includeEpisodes && activeSeasonsList.length > 0) {
          try {
            const seasonFetches = activeSeasonsList.map(async (season: any) => {
              const sRes = await fetchWithTimeout(
                `https://api.themoviedb.org/3/tv/${movieId}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=en-US`
              );
              if (sRes.ok) {
                const sData = await sRes.json();
                return {
                  season_number: sData.season_number,
                  name: sData.name,
                  air_date: sData.air_date,
                  episodes: (sData.episodes || []).map((ep: any) => ({
                    id: ep.id,
                    name: ep.name,
                    episode_number: ep.episode_number,
                    air_date: ep.air_date,
                    runtime: ep.runtime || episodeRuntime,
                    overview: ep.overview,
                  })),
                };
              }
              return null;
            });
            const resolvedSeasons = await Promise.all(seasonFetches);
            seasonsWithEpisodes = resolvedSeasons.filter(Boolean);
          } catch (e) {
            console.error("Failed to fetch TMDB season episodes details:", e);
          }
        }

        return NextResponse.json({ 
          ...data, 
          runtime: totalRuntime,
          seasons,
          number_of_episodes: numEpisodes,
          category,
          trailerKey,
          seasonsWithEpisodes,
        });
      }

      return NextResponse.json({
        ...data,
        seasons: null,
        category,
        trailerKey,
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
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (section === "next_week") {
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);
        const nextWeekDate = nextWeek.toISOString().split("T")[0];

        const movieUrl = `https://api.tmdb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${nextWeekDate}&page=1`;
        const tvUrl = `https://api.tmdb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&first_air_date.gte=${today}&first_air_date.lte=${nextWeekDate}&page=1`;

        try {
          const [movieRes, tvRes] = await Promise.all([
            fetchWithTimeout(movieUrl, {}, 2500),
            fetchWithTimeout(tvUrl, {}, 2500)
          ]);

          let movieResults = [];
          let tvResults = [];

          if (movieRes.ok) {
            const movieData = await movieRes.json();
            movieResults = (movieData.results || []).map((item: any) => ({
              ...item,
              media_type: "movie"
            }));
          }
          if (tvRes.ok) {
            const tvData = await tvRes.json();
            tvResults = (tvData.results || []).map((item: any) => ({
              ...item,
              media_type: "tv"
            }));
          }

          const combined = [...movieResults, ...tvResults]
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

          const mapped = combined.map((item: any) => {
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
              popularity: item.popularity,
              vote_count: item.vote_count,
            };
          });

          return NextResponse.json({ results: mapped });
        } catch (e) {
          console.error("Failed next_week combined fetch:", e);
          return NextResponse.json({ results: [] });
        }
      }

      let endpoint = "";
      if (section === "trending_today") {
        endpoint = `https://api.tmdb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=en-US`;
      } else if (section === "trending_week") {
        endpoint = `https://api.tmdb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`;
      } else {
        return NextResponse.json({ error: "Invalid section parameter" }, { status: 400 });
      }

      const response = await fetchWithTimeout(endpoint, {}, 2000);
      if (!response.ok) throw new Error(`TMDB fetch failed for section: ${section}`);
      const data = await response.json();

      const mapped = (data.results || [])
        .slice(0, 20)
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
            popularity: item.popularity,
            vote_count: item.vote_count,
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

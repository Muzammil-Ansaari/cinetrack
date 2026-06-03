import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Network request timeout wrapper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 12000) {
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

// Search TMDB videos by IMDB ID
async function fetchTMDBTrailerByImdb(imdbId: string): Promise<string | null> {
  if (!TMDB_API_KEY || !imdbId) return null;
  try {
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const findRes = await fetchWithTimeout(findUrl);
    if (!findRes.ok) return null;
    const findData = await findRes.json();

    let tmdbId = null;
    let type = "movie";

    if (findData.tv_results && findData.tv_results.length > 0) {
      tmdbId = findData.tv_results[0].id;
      type = "tv";
    } else if (findData.movie_results && findData.movie_results.length > 0) {
      tmdbId = findData.movie_results[0].id;
      type = "movie";
    }

    if (tmdbId) {
      const videosUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
      const videosRes = await fetchWithTimeout(videosUrl);
      if (videosRes.ok) {
        const videosData = await videosRes.json();
        const videos = videosData.results || [];
        const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") || 
                        videos.find((v: any) => v.site === "YouTube") || 
                        null;
        return trailer?.key || null;
      }
    }
  } catch (e) {
    console.error("Failed to fetch TMDB trailer by IMDB ID:", e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const category = searchParams.get("category") || "Movie";

  if (!id) {
    return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
  }

  try {

    // ----------------------------------------------------
    // TMDB FLOW (MOVIE OR TV SHOW)
    // ----------------------------------------------------
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY is not configured on the server");
    }

    const isTv = category === "TV Show" || category === "Anime";
    const detailUrl = `https://api.themoviedb.org/3/${isTv ? "tv" : "movie"}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
    
    const detailRes = await fetchWithTimeout(detailUrl);
    if (!detailRes.ok) {
      throw new Error(`TMDB details request failed with status: ${detailRes.status}`);
    }
    const data = await detailRes.json();

    const videos = data.videos?.results || [];
    const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") || 
                    videos.find((v: any) => v.site === "YouTube") || 
                    null;
    const trailerKey = trailer?.key || null;

    let seasonsWithEpisodes = null;
    let upcomingSeason = null;
    let nextEpisode = null;

    if (isTv) {
      const today = new Date().toISOString().split("T")[0];
      
      // Parse next episode to air from TMDB
      if (data.next_episode_to_air) {
        nextEpisode = {
          season_number: data.next_episode_to_air.season_number,
          episode_number: data.next_episode_to_air.episode_number,
          air_date: data.next_episode_to_air.air_date,
        };
      }

      if (data.seasons && Array.isArray(data.seasons)) {
        // Filter out Specials/Season 0 and upcoming/future seasons
        const activeSeasons = data.seasons.filter(
          (s: any) => s.season_number > 0 && 
                      s.episode_count > 0 && 
                      (!s.air_date || s.air_date <= today)
        );

        // Find upcoming seasons
        const upcomingSeasonsList = data.seasons.filter((s: any) => {
          return s.season_number > 0 && (
            (s.air_date && s.air_date > today) ||
            (!s.air_date && s.season_number > activeSeasons.length)
          );
        });
        if (upcomingSeasonsList.length > 0) {
          upcomingSeasonsList.sort((a: any, b: any) => a.season_number - b.season_number);
          upcomingSeason = {
            season_number: upcomingSeasonsList[0].season_number,
            name: upcomingSeasonsList[0].name || `Season ${upcomingSeasonsList[0].season_number}`,
            air_date: upcomingSeasonsList[0].air_date || null,
          };
        }

        try {
          const seasonFetches = activeSeasons.map(async (season: any) => {
            const sRes = await fetchWithTimeout(
              `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=en-US`
            );
            if (sRes.ok) {
              const sData = await sRes.json();
              return {
                season_number: sData.season_number,
                name: sData.name || `Season ${sData.season_number}`,
                air_date: sData.air_date || "N/A",
                episodes: (sData.episodes || [])
                  .filter((ep: any) => !ep.air_date || ep.air_date <= today)
                  .map((ep: any) => ({
                    id: ep.id,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    episode_number: ep.episode_number,
                    air_date: ep.air_date || "N/A",
                    runtime: ep.runtime || data.episode_run_time?.[0] || 45,
                    overview: ep.overview || "",
                  })),
              };
            }
            return null;
          });

          const resolvedSeasons = await Promise.all(seasonFetches);
          seasonsWithEpisodes = resolvedSeasons.filter(Boolean);
        } catch (e) {
          console.error("Failed to load TMDB season episodes list:", e);
        }
      }
    }

    return NextResponse.json({
      title: data.title || data.name,
      overview: data.overview || "",
      backdrop_path: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
      poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : null,
      release_year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A",
      release_date: data.release_date || data.first_air_date || null,
      runtime: isTv 
        ? (data.episode_run_time?.[0] || 45) * (data.number_of_episodes || 12)
        : data.runtime || 120,
      global_rating: data.vote_average || null,
      genres: data.genres ? data.genres.map((g: any) => g.name).join(", ") : "",
      trailerKey,
      seasonsWithEpisodes,
      source: "tmdb",
      status: data.status,
      upcomingSeason,
      nextEpisode,
    });

  } catch (err: any) {
    console.error("Details API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve details" }, { status: 500 });
  }
}

"use client";

import React, { useEffect, useState } from "react";
import { Play, Check, ChevronRight, Star } from "lucide-react";
import { TMDBMovie } from "@/types";

interface CinemaHeroProps {
  onAddMovie: (tmdbMovie: TMDBMovie, watched: boolean) => Promise<void>;
  isTracked: (tmdbId: string) => boolean;
}

const FALLBACK_MOVIES: TMDBMovie[] = [
  {
    id: 27205,
    title: "Inception",
    poster_path: "/oYu230wZPPwqVbAK8Kz54K2GvmT.jpg",
    backdrop_path: "/s3TsuCVHQCXOkUuUBUz4EXu6Vsy.jpg",
    release_date: "2010-07-15",
    vote_average: 8.4,
    overview: "Cobb, a skilled thief who steals valuable secrets from deep within the subconscious during the dream state, is offered a chance to have his criminal history erased as payment for a seemingly impossible task: \"inception\", the implantation of another person's idea.",
    media_type: "movie",
    category: "Movie"
  },
  {
    id: 157336,
    title: "Interstellar",
    poster_path: "/gEU2QniE6E7vNIwbaCU6OnwRPF7.jpg",
    backdrop_path: "/xJHokZbljvjC1nJyW9vOI3L6JvN.jpg",
    release_date: "2014-11-05",
    vote_average: 8.4,
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    media_type: "movie",
    category: "Movie"
  },
  {
    id: 19995,
    title: "Avatar",
    poster_path: "/kyeE2m2Xn6n4rA354YObx5NIjvv.jpg",
    backdrop_path: "/v1Z4y447n55n7Mv8rJb4K7L5Zq.jpg",
    release_date: "2009-12-15",
    vote_average: 7.6,
    overview: "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following orders and protecting an alien civilization.",
    media_type: "movie",
    category: "Movie"
  },
  {
    id: 49051,
    title: "Attack on Titan",
    poster_path: "/9OfKu7nB4gx64FsiUqviS5657yq.jpg",
    backdrop_path: "/piNfH0h9Ewz557gWbO27OOpdD6t.jpg",
    release_date: "2013-04-07",
    vote_average: 8.7,
    overview: "Several hundred years ago, humans were nearly exterminated by Titans. Titans are typically several stories tall, seem to have no intelligence, devour human beings and, worst of all, seem to do it for the pleasure rather than as a food source.",
    media_type: "tv",
    seasons: 4,
    category: "Anime"
  }
];

export default function CinemaHero({ onAddMovie, isTracked }: CinemaHeroProps) {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingState, setAddingState] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/tmdb?trending=true");
        if (!res.ok) throw new Error("Failed to fetch trending movies");
        const data = await res.json();
        // Take top 6 trending movies
        if (data.results && data.results.length > 0) {
          setMovies(data.results.slice(0, 6));
        } else {
          setMovies(FALLBACK_MOVIES);
        }
      } catch (err) {
        console.warn("Failed to load trending movies from TMDB API, falling back to offline curated list.", err);
        setMovies(FALLBACK_MOVIES);
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  // Automatic slideshow rotating every 8 seconds
  useEffect(() => {
    if (movies.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % movies.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [movies]);

  if (loading) {
    return (
      <div className="relative w-full h-[320px] md:h-[400px] rounded-2xl bg-zinc-900 animate-pulse flex items-end p-8 border border-zinc-800/40">
        <div className="space-y-3 w-full max-w-lg">
          <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
          <div className="h-8 bg-zinc-800 rounded w-2/3"></div>
          <div className="h-3 bg-zinc-800 rounded w-full"></div>
          <div className="h-3 bg-zinc-800 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  const currentMovie = movies[currentIndex];
  const backdropUrl = currentMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${currentMovie.backdrop_path}`
    : "";
  const year = currentMovie.release_date ? currentMovie.release_date.split("-")[0] : "";
  const rating = currentMovie.vote_average ? currentMovie.vote_average.toFixed(1) : "N/A";
  const movieTracked = isTracked(currentMovie.id.toString());

  const handleAddClick = async (watched: boolean) => {
    const key = `${currentMovie.id}-${watched}`;
    if (addingState[key]) return;

    setAddingState((prev) => ({ ...prev, [key]: true }));
    try {
      await onAddMovie(currentMovie, watched);
    } finally {
      setAddingState((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <section className="relative w-full h-[320px] md:h-[400px] rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950 group">
      {/* Background Image Slider with Crossfade */}
      <div className="absolute inset-0 transition-opacity duration-1000 ease-in-out">
        {backdropUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={backdropUrl}
            alt={currentMovie.title}
            className="w-full h-full object-cover opacity-35 scale-100 group-hover:scale-105 transition-transform duration-[10000ms] ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col items-start max-w-2xl z-10">
        <span className="text-[10px] tracking-wider font-semibold uppercase bg-zinc-800/80 border border-zinc-700/50 text-indigo-400 px-2.5 py-1 rounded-full mb-3 shadow-sm backdrop-blur-sm">
          🔥 Now Trending
        </span>
        
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2 select-none">
          {currentMovie.title}
        </h2>
        
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-3 select-none">
          <span>{year}</span>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <span className="flex items-center gap-1 text-amber-500 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-500/20" />
            {rating}/10
          </span>
        </div>

        <p className="text-xs md:text-sm text-zinc-400 line-clamp-2 md:line-clamp-3 mb-6 font-normal leading-relaxed select-none">
          {currentMovie.overview || "Explore this acclaimed cinematic masterpiece and add it to your tracking logs."}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {movieTracked ? (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-400 text-xs font-semibold backdrop-blur-sm shadow-sm select-none">
              <Check className="w-4 h-4 text-emerald-500" /> Added to Tracker
            </div>
          ) : (
            <>
              <button
                onClick={() => handleAddClick(false)}
                disabled={addingState[`${currentMovie.id}-false`]}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 active:scale-[0.98] transition-all text-zinc-950 text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-zinc-950" />
                Want to Watch
              </button>
              <button
                onClick={() => handleAddClick(true)}
                disabled={addingState[`${currentMovie.id}-true`]}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800/90 hover:border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl backdrop-blur-sm shadow-sm cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Already Watched
              </button>
            </>
          )}

          {/* Slide Arrow Selector */}
          <button
            onClick={() => setCurrentIndex((currentIndex + 1) % movies.length)}
            className="w-8 h-8 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-colors active:scale-95"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

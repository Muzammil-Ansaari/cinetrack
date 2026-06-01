"use client";

import React, { useState } from "react";
import { Film, Check, Trash2 } from "lucide-react";
import { Movie } from "@/types";

interface MovieCardProps {
  movie: Movie;
  friends: string[];
  myName: string;
  onToggleFriendWatched: (id: string, friendName: string) => Promise<void>;
  onDeleteMovie: (id: string) => Promise<void>;
  onUpdateFriendRating: (id: string, friendName: string, rating: number) => Promise<void>;
  onUpdateFriendReview: (id: string, friendName: string, review: string) => Promise<void>;
}

export default function MovieCard({
  movie,
  friends,
  myName,
  onToggleFriendWatched,
  onDeleteMovie,
  onUpdateFriendRating,
  onUpdateFriendReview,
}: MovieCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Find who added this movie
  const addedBy = movie.reviews_json || "Someone";

const posterPath = movie.poster_path ?? "";

const isCustomGradient =
  posterPath.startsWith("custom-gradient:");

const gradientClass = isCustomGradient
  ? posterPath.split(":")[1] ?? ""
  : "";

  const getGradientBg = (colorName: string) => {
    switch (colorName) {
      case "emerald-teal":
        return "bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-600";
      case "midnight-aurora":
        return "bg-gradient-to-br from-cyan-600 via-indigo-700 to-violet-650";
      case "volcanic-amber":
        return "bg-gradient-to-br from-orange-500 via-red-600 to-pink-700";
      case "indigo-pink":
      default:
        return "bg-gradient-to-br from-indigo-500 via-purple-650 to-pink-500";
    }
  };

  const posterUrl = movie.poster_path && !isCustomGradient
    ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
    : "";

  const formatRuntime = (mins: number) => {
    if (mins <= 0) return "N/A";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  };

  // Extract watched and pending friends summaries
  const watchedBy = movie.watched_by ? movie.watched_by.split(", ").filter(Boolean) : [];

  return (
    <article className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl hover:border-zinc-750 hover:bg-zinc-900/90 transition-all duration-300 shadow-sm group">
      {/* Movie Poster thumbnail */}
      <div className="w-[84px] h-[120px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-850 shadow-sm flex-shrink-0 relative select-none flex items-center justify-center">
        {isCustomGradient ? (
          <div className={`w-full h-full flex flex-col justify-between items-center text-center p-2 text-white select-none ${getGradientBg(gradientClass)} group-hover:scale-105 transition-transform duration-500 ease-out`}>
            <span className="text-[6px] font-black uppercase tracking-widest text-white/50 mt-1">Custom Entry</span>
            <Film className="w-5 h-5 text-white/80 my-1" />
            <span className="text-[7.5px] font-extrabold text-white leading-tight line-clamp-3 select-none mb-1">
              {movie.title}
            </span>
          </div>
        ) : posterUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const sibling = e.currentTarget.nextElementSibling;
                if (sibling) {
                  sibling.classList.remove('hidden');
                }
              }}
            />
            {/* Fallback offline gradient */}
            <div className="fallback-placeholder hidden absolute inset-0 bg-gradient-to-br from-indigo-950 via-zinc-900 to-purple-950/80 flex flex-col items-center justify-center p-1.5 text-center select-none animate-fade-in">
              <Film className="w-5 h-5 mb-1 text-indigo-400 opacity-60" />
              <span className="text-[7.5px] font-extrabold text-zinc-300 uppercase tracking-wider leading-tight line-clamp-3">
                {movie.title}
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col justify-center items-center text-center p-2 text-zinc-650 bg-zinc-950 select-none">
            <Film className="w-5 h-5 mb-1 opacity-30" />
            <span className="text-[7.5px] font-bold uppercase tracking-wider">No Poster</span>
          </div>
        )}
      </div>

      {/* Movie Main Metadata */}
      <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Added by Kicker at the very top */}
          {addedBy && (
            <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-400 mb-0.5 select-none leading-none">
              📥 Added by {addedBy}
            </p>
          )}

          {/* Header row: Title & Action buttons */}
          <div className="flex items-start justify-between gap-3 w-full">
            <h3 className="text-sm font-black text-zinc-100 select-all line-clamp-2 leading-tight flex-1 min-w-0" title={movie.title}>
              {movie.title}
            </h3>
            
            <div className="flex items-center gap-1.5 flex-shrink-0 select-none">
              {/* User-specific Mark as Watched Toggle */}
              {watchedBy.includes(myName) ? (
                <button
                  onClick={() => onToggleFriendWatched(movie.id, myName)}
                  className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center cursor-pointer transition-all active:scale-90 duration-200 shadow-sm"
                  title="You watched this — click to unmark"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              ) : (
                <button
                  onClick={() => onToggleFriendWatched(movie.id, myName)}
                  className="w-7 h-7 rounded-lg bg-zinc-950 hover:bg-amber-500 border border-zinc-800 hover:border-amber-500 text-zinc-400 hover:text-zinc-950 flex items-center justify-center cursor-pointer transition-all active:scale-90 duration-200 shadow-sm"
                  title="Mark as watched"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Delete Button */}
              <button
                onClick={() => onDeleteMovie(movie.id)}
                className="w-7 h-7 rounded-lg bg-zinc-950 hover:bg-red-500/15 border border-zinc-800 hover:border-red-500/40 text-zinc-600 hover:text-red-400 flex items-center justify-center cursor-pointer transition-all active:scale-90 duration-200 shadow-sm"
                title="Remove from library"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Formats, ratings metadata row */}
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-zinc-500 mt-1 select-none">
            {movie.category && (
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                movie.category === "Anime" 
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/10"
                  : movie.category === "TV Show"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/10"
                  : movie.category === "Animated Movie"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
              }`}>
                {movie.category}
              </span>
            )}
            <span>{movie.release_year || "N/A"}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
            <span>{formatRuntime(movie.runtime)}</span>
            {movie.seasons && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                <span className="text-zinc-400 font-semibold">{movie.seasons} {movie.seasons === 1 ? "Season" : "Seasons"}</span>
              </>
            )}
            {movie.global_rating !== undefined && movie.global_rating !== null && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                <span className="text-amber-500 font-semibold">⭐ {movie.global_rating.toFixed(1)}</span>
              </>
            )}
          </div>

          {/* Clean Dot-separated Genres Row */}
          {movie.genres && (
            <p className="text-[8.5px] text-indigo-400/90 font-extrabold uppercase tracking-wider mt-1.5 select-none leading-none">
              {movie.genres.split(", ").join(" • ")}
            </p>
          )}

          {/* Synopsis (Stateful Expandable Synopsis) */}
          {movie.synopsis && (
            <div className="mt-2 text-[10px] leading-relaxed select-text">
              <p className={isExpanded ? "text-zinc-450" : "line-clamp-2 text-zinc-500"}>
                {movie.synopsis}
              </p>
              {movie.synopsis.length > 120 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[8px] text-indigo-450 hover:text-indigo-400 font-extrabold uppercase tracking-wider mt-1 cursor-pointer transition-colors"
                >
                  {isExpanded ? "Collapse Synopsis ▲" : "Read Full Synopsis ▼"}
                </button>
              )}
            </div>
          )}
        </div>





      </div>
    </article>
  );
}

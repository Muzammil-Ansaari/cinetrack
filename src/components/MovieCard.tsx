"use client";

import React, { useState, useEffect } from "react";
import { Film, Check, ThumbsDown, Plus } from "lucide-react";
import { Movie } from "@/types";

interface MovieCardProps {
  movie: Movie;
  friends: string[];
  myName: string;
  onToggleFriendWatched: (id: string, friendName: string) => Promise<void>;
  onToggleDeclined: (id: string, friendName: string) => Promise<void>;
  onUpdateFriendRating: (id: string, friendName: string, rating: number) => Promise<void>;
  onUpdateFriendReview: (id: string, friendName: string, review: string) => Promise<void>;
  onCardClick?: () => void;
  isInMyList?: boolean;
  onAddToMyList?: () => void;
  /** Override: whether the current user personally watched this title (used when viewing a friend's row) */
  myWatched?: boolean;
  /** Override: whether the current user personally declined this title (used when viewing a friend's row) */
  myDeclined?: boolean;
}

export default function MovieCard({
  movie,
  friends,
  myName,
  onToggleFriendWatched,
  onToggleDeclined,
  onUpdateFriendRating,
  onUpdateFriendReview,
  onCardClick,
  isInMyList = true,
  onAddToMyList,
  myWatched,
  myDeclined,
}: MovieCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localReleaseDate, setLocalReleaseDate] = useState<string | null>(movie.release_date || null);

  const posterPath = movie.poster_path ?? "";
  const isCustomGradient = posterPath.startsWith("custom-gradient:");
  const isNumericId = /^\d+$/.test(movie.tmdb_id || "");

  useEffect(() => {
    if (!movie.release_date && movie.tmdb_id && isNumericId && !isCustomGradient) {
      const isTv = movie.category === "TV Show" || movie.category === "Anime";
      const catParam = isTv ? "TV Show" : "Movie";
      fetch(`/api/details?id=${movie.tmdb_id}&category=${encodeURIComponent(catParam)}`)
        .then((res) => {
          if (!res.ok) {
            console.warn(`Silently failed to load details for tmdb_id ${movie.tmdb_id}`);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.release_date) {
            setLocalReleaseDate(data.release_date);
            fetch(`/api/movies?id=${movie.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ release_date: data.release_date }),
            }).catch((err) => console.error("Failed silently to update release date in DB:", err));
          }
        })
        .catch((err) => console.warn("Error fetching release date:", err));
    }
  }, [movie.release_date, movie.tmdb_id, movie.category, movie.id, isNumericId, isCustomGradient]);

  // Find who added this movie
  const addedBy = movie.reviews_json || "Someone";

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

  const formatReleaseDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return dateStr;
    return `${months[monthIndex]} ${parseInt(day, 10)}, ${year}`;
  };

  // Extract watched and pending friends summaries
  // If myWatched/myDeclined props are provided (viewing friend's row), use those for the current user's status
  const watchedBy = movie.watched_by ? movie.watched_by.split(", ").filter(Boolean) : [];
  const declinedBy = movie.declined_by ? movie.declined_by.split(", ").filter(Boolean) : [];

  // Resolve the current user's actual status:
  // - prefer explicit override props (myWatched / myDeclined) when viewing a friend's row
  // - fall back to the movie row's watched_by / declined_by fields
  const iAmWatched  = myWatched  !== undefined ? myWatched  : watchedBy.includes(myName);
  const iAmDeclined = myDeclined !== undefined ? myDeclined : declinedBy.includes(myName);

  const renderActionButtons = () => {
    return (
      <div className="grid grid-cols-2 gap-1.5 w-full select-none">
        {/* User-specific Mark as Watched Toggle — uses iAmWatched which respects cross-row status */}
        {iAmWatched ? (
          <button
            onClick={() => onToggleFriendWatched(movie.id, myName)}
            className="h-[28px] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm text-[9px] font-bold"
            title="You watched this — click to unmark"
          >
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>Watched</span>
          </button>
        ) : (
          <button
            onClick={() => onToggleFriendWatched(movie.id, myName)}
            className="h-[28px] rounded-lg bg-zinc-950 hover:bg-amber-500 border border-zinc-800 hover:border-amber-500 text-zinc-400 hover:text-zinc-950 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm text-[9px] font-bold"
            title="Mark as watched"
          >
            <Check className="w-3 h-3" />
            <span>Watched</span>
          </button>
        )}

        {/* Decline / Not Interested Button — uses iAmDeclined which respects cross-row status */}
        {iAmDeclined ? (
          <button
            onClick={() => onToggleDeclined(movie.id, myName)}
            className="h-[28px] rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 text-amber-500 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm text-[9px] font-bold"
            title="You declined this — click to restore"
          >
            <ThumbsDown className="w-3 h-3 stroke-[2.5]" />
            <span>Declined</span>
          </button>
        ) : (
          <button
            onClick={() => onToggleDeclined(movie.id, myName)}
            className="h-[28px] rounded-lg bg-zinc-950 hover:bg-red-500/15 border border-zinc-800 hover:border-red-500/40 text-zinc-650 hover:text-red-400 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm text-[9px] font-bold"
            title="Not Interested / Decline"
          >
            <ThumbsDown className="w-3 h-3" />
            <span>Decline</span>
          </button>
        )}
      </div>
    );
  };

  // Compile a clean list of metadata items
  const metaItems: string[] = [];
  const fullDate = formatReleaseDate(localReleaseDate) || formatReleaseDate(movie.release_date);
  if (fullDate) {
    metaItems.push(fullDate);
  } else if (movie.release_year) {
    metaItems.push(movie.release_year);
  }

  if (movie.category === "TV Show" || movie.category === "Anime") {
    if (movie.seasons) {
      metaItems.push(`${movie.seasons} ${movie.seasons === 1 ? "Season" : "Seasons"}`);
    } else if (movie.episodes) {
      metaItems.push(`${movie.episodes} ${movie.episodes === 1 ? "Ep" : "Eps"}`);
    }
  } else {
    const formattedRuntime = formatRuntime(movie.runtime);
    if (formattedRuntime !== "N/A") {
      metaItems.push(formattedRuntime);
    }
  }

  if (movie.global_rating !== undefined && movie.global_rating !== null && movie.global_rating > 0) {
    metaItems.push(`⭐ ${movie.global_rating.toFixed(1)}`);
  }

  const metadataText = metaItems.join("  •  ");

  const today = new Date().toISOString().split("T")[0];
  const effectiveReleaseDate = localReleaseDate || movie.release_date;
  const isUpcoming = effectiveReleaseDate ? effectiveReleaseDate > today : false;

  return (
    <article className="flex flex-col gap-2 p-2.5 bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-indigo-500/25 rounded-2xl transition-all duration-300 shadow-lg group relative overflow-hidden h-full justify-between w-full">
      {/* Movie Poster thumbnail */}
      <div 
        onClick={onCardClick}
        className="w-full aspect-[2/3] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-md flex-shrink-0 relative select-none flex items-center justify-center cursor-pointer hover:border-indigo-500/40 hover:shadow-[0_0_12px_rgba(99,102,241,0.2)] active:scale-95 transition-all duration-300"
        title="Click to view details, episodes & trailer"
      >
        {isCustomGradient ? (
          <div className={`w-full h-full flex flex-col justify-between items-center text-center p-2.5 text-white select-none ${getGradientBg(gradientClass)} group-hover:scale-105 transition-transform duration-500 ease-out`}>
            <span className="text-[6.5px] font-black uppercase tracking-widest text-white/60 mt-1">Custom Entry</span>
            <Film className="w-5 h-5 text-white/80 my-1" />
            <span className="text-[9px] font-black text-white leading-tight line-clamp-4 select-none mb-1">
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

        {/* Top-Left Category Badge on Poster */}
        {movie.category && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-zinc-950/90 text-zinc-100 border border-zinc-800 text-[7px] font-extrabold uppercase tracking-wider backdrop-blur-[2px] select-none z-10">
            {movie.category}
          </span>
        )}
      </div>

      {/* Movie Main Metadata */}
      <div className="flex-grow min-w-0 flex flex-col justify-between pt-2 pb-0.5 px-0.5">
        <div>
          {/* Header row: Title */}
          <div className="w-full">
            <h3 
              onClick={onCardClick}
              className="text-[13px] sm:text-[14px] font-extrabold text-zinc-100 select-all line-clamp-2 leading-tight cursor-pointer hover:text-indigo-400 transition-colors" 
              title="Click to view details, episodes & trailer"
            >
              {movie.title}
            </h3>
          </div>

          {/* Formats, ratings metadata row */}
          {metadataText && (
            <div className="text-[9.5px] font-semibold text-zinc-400/90 select-none leading-normal mt-1">
              {metadataText}
            </div>
          )}

          {/* Clean Dot-separated Genres Row */}
          {movie.genres && (
            <p className="text-[8px] text-indigo-400/80 font-bold uppercase tracking-wider mt-1.5 select-none leading-none truncate">
              {movie.genres.split(", ").slice(0, 2).join(" • ")}
            </p>
          )}
        </div>

        {/* Footer actions row */}
        <div className="mt-3.5 pt-2 border-t border-zinc-800/40 select-none w-full flex flex-col gap-1.5">
          {onAddToMyList && (
            isInMyList ? (
              <div
                className="w-full h-[28px] rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center gap-1 text-[9px] font-extrabold select-none uppercase tracking-wider"
                title="This movie is already in your personal list"
              >
                <Check className="w-3 h-3" />
                <span>In Your List</span>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToMyList(); }}
                className="w-full h-[28px] rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 text-[9px] font-bold"
                title="Add this to your personal list"
              >
                <Plus className="w-3 h-3" />
                <span>Add to My List</span>
              </button>
            )
          )}
          {isUpcoming ? (
            <div className="w-full h-[28px] rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400/90 flex items-center justify-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-widest select-none">
              ⏳ Coming Soon
            </div>
          ) : (
            renderActionButtons()
          )}
        </div>
      </div>
    </article>
  );
}

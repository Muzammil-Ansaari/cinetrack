"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, Plus, Check, ArrowRight } from "lucide-react";
import { TMDBMovie } from "@/types";

interface SearchBarProps {
  onAddMovie: (tmdbMovie: TMDBMovie, watched: boolean) => Promise<void>;
  isTracked: (tmdbId: string) => boolean;
  onSearchSubmit?: (query: string) => void;
}

export default function SearchBar({ onAddMovie, isTracked, onSearchSubmit }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addingState, setAddingState] = useState<{ [key: string]: boolean }>({});
  const [isFocused, setIsFocused] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown event to focus SearchBar with '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.hasAttribute("contenteditable")
      );
      if (e.key === "/" && !isEditing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second robust client search timeout

        const res = await fetch(
          `/api/tmdb?query=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("Search request failed");
        const data = await res.json();
        
        if (data.results) {
          setResults(data.results);
        } else {
          setResults([]);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error searching movies:", err);
        }
      } finally {
        setLoading(false);
      }
    }, 450); // 450ms debounce delay

    return () => {
      clearTimeout(delayDebounce);
      controller.abort(); // Cancel any outstanding fetches immediately when query changes
    };
  }, [query]);

  // Click outside to close results dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = async (movie: TMDBMovie, watched: boolean) => {
    const key = `${movie.id}-${watched}`;
    if (addingState[key]) return;

    setAddingState((prev) => ({ ...prev, [key]: true }));
    try {
      await onAddMovie(movie, watched);
    } finally {
      setAddingState((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full z-30">
      {/* Search Input Container */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (query.trim()) setOpen(true);
          }}
          onBlur={() => {
            // Delay slightly so click events inside the dropdown fire first
            setTimeout(() => setIsFocused(false), 200);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim() && onSearchSubmit) {
              onSearchSubmit(query.trim());
              setOpen(false);
            }
          }}
          placeholder="Search movies, TV shows, anime, cartoon movies..."
          className="w-full pl-11 pr-12 py-3 bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/60 focus:border-indigo-500/80 rounded-xl text-zinc-100 text-sm font-medium transition-all shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] focus:shadow-[0_10px_30px_rgba(99,102,241,0.06)] focus:outline-none placeholder:text-zinc-500 backdrop-blur-md focus:ring-4 focus:ring-indigo-500/5"
        />
        
        {/* Right Indicators: Spinner, Clear, or Keyboard Hint Badge */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          ) : query ? (
            <button
              onClick={handleClear}
              className="text-zinc-500 hover:text-zinc-300 w-5 h-5 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : !isFocused ? (
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 bg-zinc-850/80 border border-zinc-800/85 text-[9px] font-bold text-zinc-500 rounded font-sans select-none pointer-events-none">
              /
            </kbd>
          ) : null}
        </div>
      </div>

      {/* Floating Glass Search Dropdown Panel */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950/95 border border-zinc-900 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl transition-all z-40 max-h-[380px] overflow-y-auto ring-1 ring-zinc-800/40">
          <div className="px-4 py-2.5 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest select-none">
            <span>Matching Global Database</span>
            <span>Press esc to close</span>
          </div>
          
          <div className="divide-y divide-zinc-900">
            {results.map((movie) => {
              const year = movie.release_date ? movie.release_date.split("-")[0] : "N/A";
              const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
              const posterUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                : "";
              const movieTracked = isTracked(movie.id.toString());

              return (
                <div
                  key={movie.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-zinc-900/60 transition-colors"
                >
                  {/* First Row: Poster + Info */}
                  <div className="flex items-start gap-3 sm:gap-4 flex-grow min-w-0">
                    {/* Poster Thumbnail */}
                    <div className="w-9 h-12 rounded bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800 shadow-sm select-none relative flex items-center justify-center">
                      {posterUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={posterUrl}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.nextElementSibling;
                              if (sibling) {
                                sibling.classList.remove('hidden');
                              }
                            }}
                          />
                          {/* Compact Search Fallback Gradient */}
                          <div className="fallback-placeholder hidden absolute inset-0 bg-gradient-to-br from-indigo-950 via-zinc-900 to-purple-950/80 flex items-center justify-center text-[7px] font-extrabold text-zinc-400 select-none uppercase tracking-widest text-center p-0.5">
                            {movie.title.slice(0, 3)}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[8px] font-bold text-center">
                          NO POSTER
                        </div>
                      )}
                    </div>

                    {/* Movie Info */}
                    <div className="flex-grow min-w-0 select-none">
                      <h4 className="text-sm font-bold text-zinc-100 truncate">{movie.title}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 font-medium mt-0.5">
                        {movie.category && (
                          <span className={`px-1 rounded text-[7px] font-extrabold uppercase ${
                            movie.category === "Anime"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/10"
                              : movie.category === "TV Show"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/10"
                              : movie.category === "Animated Movie"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                          }`}>
                            {movie.category}
                          </span>
                        )}
                        <span>{year}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                        <span className="text-amber-500">⭐ {rating}</span>
                        {movie.seasons && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                            <span className="text-zinc-400 font-semibold">{movie.seasons} {movie.seasons === 1 ? "season" : "seasons"}</span>
                          </>
                        )}
                        {movie.episodes && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                            <span className="text-zinc-450 font-semibold">{movie.episodes} eps</span>
                          </>
                        )}
                        {movie.runtime && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                            <span className="text-zinc-450 font-semibold">
                              {movie.runtime}m
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Second Row: Action Triggers */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 select-none pl-12 sm:pl-0">
                    {movieTracked ? (
                      <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-zinc-900/80 border border-zinc-850 text-zinc-500 text-[10px] font-semibold rounded-lg select-none w-full sm:w-auto">
                        <Check className="w-3 h-3 text-emerald-500" /> Tracked
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAdd(movie, false)}
                          disabled={addingState[`${movie.id}-false`]}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] font-bold rounded-lg border border-zinc-800 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3 text-zinc-400" /> Queue
                        </button>
                        <button
                          onClick={() => handleAdd(movie, true)}
                          disabled={addingState[`${movie.id}-true`]}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-950 text-[10px] font-bold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3 h-3 text-zinc-950" /> Watched
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show full matching results kicker */}
          {onSearchSubmit && query.trim() && (
            <button
              onClick={() => {
                onSearchSubmit(query.trim());
                setOpen(false);
              }}
              className="w-full px-4 py-3 bg-zinc-950/80 hover:bg-indigo-500/10 border-t border-zinc-900 text-left text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]"
            >
              <span>Show all matching search results for &ldquo;{query}&rdquo;</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

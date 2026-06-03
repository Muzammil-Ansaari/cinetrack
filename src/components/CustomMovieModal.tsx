"use client";

import React, { useState } from "react";
import { X, Film, Sparkles, Calendar, Clock, BookOpen, Hash } from "lucide-react";

interface CustomMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (movieData: {
    title: string;
    category: string;
    release_year: string;
    runtime: number;
    synopsis: string;
    genres: string;
    poster_path: string;
    watched: boolean;
    seasons?: number;
    episodes?: number;
  }) => Promise<void>;
}

export default function CustomMovieModal({ isOpen, onClose, onSave }: CustomMovieModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Movie");
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear().toString());
  const [runtime, setRuntime] = useState("120");
  const [synopsis, setSynopsis] = useState("");
  const [genres, setGenres] = useState("");
  const [gradientPreset, setGradientPreset] = useState("indigo-pink");
  const [watched, setWatched] = useState(false);
  const [seasons, setSeasons] = useState("1");
  const [episodes, setEpisodes] = useState("12");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const isTv = category === "TV Show" || category === "Anime";
      await onSave({
        title: title.trim(),
        category,
        release_year: releaseYear.trim() || "N/A",
        runtime: parseInt(runtime) || 120,
        synopsis: synopsis.trim(),
        genres: genres.trim() || "Custom",
        poster_path: `custom-gradient:${gradientPreset}`,
        watched,
        seasons: isTv ? parseInt(seasons) || 1 : undefined,
        episodes: isTv ? parseInt(episodes) || 12 : undefined,
      });

      // Reset
      setTitle("");
      setCategory("Movie");
      setReleaseYear(new Date().getFullYear().toString());
      setRuntime("120");
      setSynopsis("");
      setGenres("");
      setGradientPreset("indigo-pink");
      setWatched(false);
      setSeasons("1");
      setEpisodes("12");
      onClose();
    } catch (err) {
      console.error("Failed to create custom entry:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGradientPreview = (preset: string) => {
    switch (preset) {
      case "emerald-teal":
        return "bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-600";
      case "midnight-aurora":
        return "bg-gradient-to-br from-cyan-600 via-indigo-700 to-violet-650";
      case "volcanic-amber":
        return "bg-gradient-to-br from-orange-500 via-red-650 to-pink-700";
      case "indigo-pink":
      default:
        return "bg-gradient-to-br from-indigo-500 via-purple-650 to-pink-500";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm select-none animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/15">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Create Custom Entry</h2>
              <p className="text-[10px] text-zinc-500">Track a niche or custom show not indexable on TMDB.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Title input */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px]">Title / Name</label>
            <div className="relative">
              <Film className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter custom movie or show title..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/80 text-xs transition-colors"
              />
            </div>
          </div>

          {/* Grid row: Category & Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px]">Category Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-indigo-500/80 text-xs transition-colors cursor-pointer font-bold"
              >
                <option value="Movie">🍿 Movie</option>
                <option value="TV Show">📺 TV Show</option>
                <option value="Anime">🌸 Anime</option>
                <option value="Animated Movie">🎨 Animated Movie</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px]">Theme Color Card Preset</label>
              <select
                value={gradientPreset}
                onChange={(e) => setGradientPreset(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-indigo-500/80 text-xs transition-colors cursor-pointer font-bold"
              >
                <option value="indigo-pink">Sunset Glow (Purple/Pink)</option>
                <option value="emerald-teal">Emerald City (Teal/Green)</option>
                <option value="midnight-aurora">Midnight Aurora (Cyan/Blue)</option>
                <option value="volcanic-amber">Volcanic Amber (Orange/Red)</option>
              </select>
            </div>
          </div>

          {/* Conditional Seasons / Runtime Row */}
          <div className={`grid grid-cols-1 gap-4 ${
            category === "TV Show" || category === "Anime" ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}>
            <div className="space-y-1.5">
              <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Release Year
              </label>
              <input
                type="text"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                placeholder="2026"
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/80 text-xs text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Runtime (mins)
              </label>
              <input
                type="number"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                placeholder="120"
                min="0"
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/80 text-xs text-center"
              />
            </div>

            {(category === "TV Show" || category === "Anime") && (
              <>
                <div className="space-y-1.5 animate-fade-in">
                  <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px] flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" /> Seasons
                  </label>
                  <input
                    type="number"
                    value={seasons}
                    onChange={(e) => setSeasons(e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/80 text-xs text-center"
                  />
                </div>
                <div className="space-y-1.5 animate-fade-in">
                  <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px] flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" /> Episodes
                  </label>
                  <input
                    type="number"
                    value={episodes}
                    onChange={(e) => setEpisodes(e.target.value)}
                    placeholder="12"
                    min="1"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/80 text-xs text-center"
                  />
                </div>
              </>
            )}
          </div>

          {/* Genres tag list */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px]">Genres (Comma-separated)</label>
            <input
              type="text"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="e.g. Drama, Thriller, Indie"
              className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/80 text-xs"
            />
          </div>

          {/* Synopsis / Description input */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-zinc-350 tracking-wider uppercase text-[9px] flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Synopsis / Plot Details
            </label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Write a brief overview of this movie or show..."
              rows={3}
              className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/80 text-xs resize-none"
            />
          </div>

          {/* Presets Card Preview */}
          <div className="bg-zinc-950/45 p-3 rounded-2xl border border-zinc-800/60 flex gap-4 items-center">
            <div className="w-[48px] h-[68px] rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex-shrink-0 flex items-center justify-center relative">
              <div className={`absolute inset-0 ${getGradientPreview(gradientPreset)}`} />
              <Film className="w-4 h-4 text-white/80 absolute" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-300">Poster Card Accent Preview</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Renders as a gorgeous custom CSS gradient on watchlists!</p>
            </div>
          </div>

          {/* Add to Watched Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl select-none">
            <div>
              <p className="font-bold text-zinc-200">Add directly to Watched Collection?</p>
              <p className="text-[9px] text-zinc-550 mt-0.5">If disabled, it goes to your Unwatched Queue.</p>
            </div>
            <button
              type="button"
              onClick={() => setWatched(!watched)}
              className={`w-10 h-6 rounded-full p-0.5 transition-all duration-300 cursor-pointer ${
                watched ? "bg-emerald-500" : "bg-zinc-800"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                  watched ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Action Footer Buttons */}
          <div className="pt-3 border-t border-zinc-850 flex items-center justify-end gap-3 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "✨ Create Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

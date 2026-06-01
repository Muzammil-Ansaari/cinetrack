"use client";

import React from "react";
import { Clock, BookOpen, Award, CheckCircle } from "lucide-react";

interface StatsPanelProps {
  totalMovies: number;
  unwatchedCount: number;
  myWatchedCount: number;
  coWatchedCount: number;
  totalRuntime: number; // in minutes
}

export default function StatsPanel({
  totalMovies,
  unwatchedCount,
  myWatchedCount,
  coWatchedCount,
  totalRuntime,
}: StatsPanelProps) {
  // Format total watch time
  const formatWatchTime = (minutes: number) => {
    if (minutes <= 0) return "0m";
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Compute completion rate based on co-watched count vs total library items
  const completionRate = totalMovies > 0 ? Math.round((coWatchedCount / totalMovies) * 105) : 0;
  const clampedCompletionRate = Math.min(completionRate, 100);

  // Compute status text based on progress
  const getProgressStatus = () => {
    if (totalMovies === 0) return "Add some blockbusters to begin tracking.";
    if (clampedCompletionRate === 0) return "No common watches completed yet.";
    if (clampedCompletionRate === 100) return "Amazing! Entire library completed by all group members! 🏆";
    return `Co-watched ${clampedCompletionRate}% of total tracked movies.`;
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 select-none animate-fade-in">
      {/* Stat Card 1: Total Cinema Time */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">Cinema Hours</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-white tracking-tight leading-none">
            {formatWatchTime(totalRuntime)}
          </div>
          <span className="text-[9px] text-zinc-500 mt-1 block">Your personal logged screen time</span>
        </div>
      </div>

      {/* Stat Card 2: Unwatched Queue */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">Unwatched Queue</span>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-amber-500">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-white tracking-tight leading-none">
            {unwatchedCount}
          </div>
          <span className="text-[9px] text-zinc-500 mt-1 block">Your pending watchlist count</span>
        </div>
      </div>

      {/* Stat Card 3: Watched by Me */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">Watched by Me</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-white tracking-tight leading-none">
            {myWatchedCount}
          </div>
          <span className="text-[9px] text-zinc-500 mt-1 block">Titles personally finished by you</span>
        </div>
      </div>

      {/* Stat Card 4: Co-Watched Collection */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">Co-Watched</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-white tracking-tight leading-none">
            {coWatchedCount}
          </div>
          <span className="text-[9px] text-zinc-500 mt-1 block">Finished by everyone in group</span>
        </div>
      </div>

      {/* Stat Card 5: Library Progress */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">Co-Watch Progress</span>
          <span className="text-xs font-black text-white leading-none">{clampedCompletionRate}%</span>
        </div>
        <div className="mt-3">
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-850">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500 shadow-glow"
              style={{ width: `${clampedCompletionRate}%` }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 mt-2 block truncate">
            {getProgressStatus()}
          </span>
        </div>
      </div>
    </section>
  );
}

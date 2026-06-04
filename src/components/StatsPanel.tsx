"use client";

import { Clock, BookOpen, CheckCircle } from "lucide-react";

interface StatsPanelProps {
  unwatchedCount: number;
  myWatchedCount: number;
  totalRuntime: number; // in minutes
}

export default function StatsPanel({
  unwatchedCount,
  myWatchedCount,
  totalRuntime,
}: StatsPanelProps) {
  const formatWatchTime = (minutes: number) => {
    if (minutes <= 0) return "0m";
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ""}`;
  };

  const stats = [
    {
      label: "Screen Time",
      value: formatWatchTime(totalRuntime),
      sub: "Your personal watch time",
      icon: <Clock className="w-4 h-4" />,
      color: "indigo",
    },
    {
      label: "Unwatched",
      value: unwatchedCount,
      sub: "Titles yet to watch",
      icon: <BookOpen className="w-4 h-4" />,
      color: "amber",
    },
    {
      label: "Watched",
      value: myWatchedCount,
      sub: "Finished by you",
      icon: <CheckCircle className="w-4 h-4" />,
      color: "emerald",
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; bar: string }> = {
    indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-500/15",  text: "text-indigo-400",  bar: "from-indigo-500 to-indigo-400" },
    amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/15",   text: "text-amber-400",   bar: "from-amber-500 to-amber-400"  },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/15", text: "text-emerald-400", bar: "from-emerald-500 to-emerald-400" },
    violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/15",  text: "text-violet-400",  bar: "from-violet-500 to-indigo-400" },
  };

  return (
    <section className="select-none animate-fade-in space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {stats.map(({ label, value, sub, icon, color }) => {
          const c = colorMap[color];
          return (
            <div
              key={label}
              className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 md:p-5 flex flex-col gap-3 hover:border-zinc-700/60 transition-colors shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">{label}</span>
                <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center ${c.text}`}>
                  {icon}
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight leading-none">
                  {value}
                </div>
                <span className="text-[9.5px] text-zinc-500 font-medium mt-1 block">{sub}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

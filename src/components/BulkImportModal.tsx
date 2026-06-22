"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Database,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Film,
  Check,
  ArrowLeft,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { TMDBMovie } from "@/types";

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (
    items: { tmdbMovie: TMDBMovie; watched: boolean }[],
    onProgress: (current: number, total: number, title: string) => void
  ) => Promise<number>;
  isTracked: (tmdbId: string) => boolean;
  onSearchFailedTitle?: (title: string) => void;
}

type Step = "input" | "searching" | "review" | "importing" | "completed";

interface FoundItem {
  originalTitle: string;
  watched: boolean;
  status: "found";
  tmdbMovie: TMDBMovie;
  selected: boolean;
}

interface AmbiguousItemOption {
  tmdbMovie: TMDBMovie;
  selected: boolean;
  watched: boolean;
}

interface AmbiguousItem {
  originalTitle: string;
  status: "ambiguous";
  options: AmbiguousItemOption[];
}

interface NotFoundItem {
  originalTitle: string;
  status: "not_found";
}

type ResultItem = FoundItem | AmbiguousItem | NotFoundItem;

export default function BulkImportModal({
  onClose,
  onImport,
  isTracked,
  onSearchFailedTitle,
}: BulkImportModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [failedHistory, setFailedHistory] = useState<{ title: string; reason: string; timestamp: string }[]>([]);

  React.useEffect(() => {
    const saved = localStorage.getItem("cinetrack_failed_imports");
    if (saved) {
      try {
        setFailedHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed loading import failures:", e);
      }
    }
  }, []);
  const [rawInput, setRawInput] = useState("");
  const [defaultWatched, setDefaultWatched] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0, currentTitle: "" });
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentTitle: "" });
  const [importedCount, setImportedCount] = useState(0);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File Upload ──────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRawInput(text.trim());
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Parse lines ───────────────────────────────────────────────────
  const parseLines = (raw: string): { title: string; watched: boolean }[] => {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        let parts = line.includes("\t")
          ? line.split("\t").map((p) => p.trim())
          : line.split(",").map((p) => p.trim());

        const title = parts[0];
        let watched = defaultWatched;

        const last = (parts[parts.length - 1] || "").toLowerCase();
        if (["watched", "yes", "true", "1", "w", "y"].includes(last)) watched = true;
        else if (["unwatched", "no", "false", "0", "u", "n"].includes(last)) watched = false;

        return { title, watched };
      });
  };

  // ── Search Phase ──────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const lines = parseLines(rawInput);
    if (lines.length === 0) return;

    setStep("searching");
    setSearchProgress({ current: 0, total: lines.length, currentTitle: "" });

    const collected: ResultItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const { title, watched } = lines[i];
      setSearchProgress({ current: i + 1, total: lines.length, currentTitle: title });

      try {
        const res = await fetch(`/api/tmdb?query=${encodeURIComponent(title)}`);
        if (!res.ok) {
          collected.push({ originalTitle: title, status: "not_found" });
          continue;
        }

        const data = await res.json();
        const hits: TMDBMovie[] = Array.isArray(data) ? data : (data.results || []);

        if (hits.length === 0) {
          collected.push({ originalTitle: title, status: "not_found" });
          continue;
        }

        // Filter out options that are already tracked
        const untrackedHits = hits.filter((h) => !isTracked(h.id.toString()));
        if (untrackedHits.length === 0) {
          collected.push({ originalTitle: title, status: "not_found" });
          continue;
        }

        // Exact title match → auto-select
        const exactIndex = untrackedHits.findIndex(
          (h) => (h.title || h.name || "").toLowerCase() === title.toLowerCase()
        );

        if (exactIndex !== -1 || untrackedHits.length === 1) {
          const best = exactIndex !== -1 ? untrackedHits[exactIndex] : untrackedHits[0];
          collected.push({ originalTitle: title, watched, status: "found", tmdbMovie: best, selected: true });
        } else {
          // Multiple matches → user selects one or more
          const options = untrackedHits.slice(0, 5).map((opt, idx) => ({
            tmdbMovie: opt,
            selected: idx === 0, // default first one checked
            watched,
          }));
          collected.push({ originalTitle: title, status: "ambiguous", options });
        }
      } catch {
        collected.push({ originalTitle: title, status: "not_found" });
      }

      await new Promise((r) => setTimeout(r, 80));
    }

    setResults(collected);
    setStep("review");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawInput, defaultWatched]);

  // ── Confirm Import ────────────────────────────────────────────────
  const handleConfirm = async () => {
    const toImport: { tmdbMovie: TMDBMovie; watched: boolean }[] = [];

    for (const r of results) {
      if (r.status === "found" && r.selected) {
        toImport.push({ tmdbMovie: r.tmdbMovie, watched: r.watched });
      } else if (r.status === "ambiguous") {
        for (const opt of r.options) {
          if (opt.selected) {
            toImport.push({ tmdbMovie: opt.tmdbMovie, watched: opt.watched });
          }
        }
      }
    }

    // Capture failed and rejected imports to localStorage history
    const failedToSave: { title: string; reason: string; timestamp: string }[] = [];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    for (const r of results) {
      if (r.status === "not_found") {
        failedToSave.push({
          title: r.originalTitle,
          reason: "Not Found or Already Tracked",
          timestamp: now
        });
      } else if (r.status === "found" && !r.selected) {
        failedToSave.push({
          title: r.originalTitle,
          reason: "Rejected by User",
          timestamp: now
        });
      } else if (r.status === "ambiguous") {
        const anySelected = r.options.some(opt => opt.selected);
        if (!anySelected) {
          failedToSave.push({
            title: r.originalTitle,
            reason: "Rejected by User",
            timestamp: now
          });
        }
      }
    }
    
    if (failedToSave.length > 0) {
      const updatedHistory = [...failedToSave, ...failedHistory].slice(0, 100);
      setFailedHistory(updatedHistory);
      try {
        localStorage.setItem("cinetrack_failed_imports", JSON.stringify(updatedHistory));
      } catch (e) {
        console.warn("CineTrack: Failed to save failed imports to localStorage (quota exceeded)", e);
      }
    }

    if (toImport.length === 0) {
      // If nothing was selected to import, but we had failed/rejected items, we can close or complete
      setImportedCount(0);
      setStep("completed");
      return;
    }
    
    setImporting(true);
    setStep("importing");
    setImportProgress({ current: 0, total: toImport.length, currentTitle: "" });

    try {
      const count = await onImport(toImport, (curr, tot, title) => {
        setImportProgress({ current: curr, total: tot, currentTitle: title });
      });
      setImportedCount(count);
      setStep("completed");
    } catch (e) {
      console.error("Failed importing titles:", e);
      // Fallback: close the modal to avoid getting stuck
      onClose();
    } finally {
      setImporting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const toggleFoundItemSelection = (idx: number) => {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== idx || r.status !== "found") return r;
        return { ...r, selected: !r.selected };
      })
    );
  };

  const toggleFoundItemWatched = (idx: number) => {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== idx || r.status !== "found") return r;
        return { ...r, watched: !r.watched };
      })
    );
  };

  const toggleAmbiguousOptionSelection = (itemIdx: number, optIdx: number) => {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== itemIdx || r.status !== "ambiguous") return r;
        const newOptions = r.options.map((opt, j) => {
          if (j !== optIdx) return opt;
          return { ...opt, selected: !opt.selected };
        });
        return { ...r, options: newOptions };
      })
    );
  };

  const toggleAmbiguousOptionWatched = (itemIdx: number, optIdx: number) => {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== itemIdx || r.status !== "ambiguous") return r;
        const newOptions = r.options.map((opt, j) => {
          if (j !== optIdx) return opt;
          return { ...opt, watched: !opt.watched };
        });
        return { ...r, options: newOptions };
      })
    );
  };

  const foundCount = results.filter((r) => r.status === "found" && (r as FoundItem).selected).length;
  const ambigCount = results.filter((r) => r.status === "ambiguous").length;
  const notFoundCount = results.filter((r) => r.status === "not_found").length;

  const getAmbigSelectedCount = () => {
    return results.reduce((acc, r) => {
      if (r.status !== "ambiguous") return acc;
      return acc + r.options.filter((opt) => opt.selected).length;
    }, 0);
  };

  const readyCount = foundCount + getAmbigSelectedCount();

  const posterUrl = (path: string | null | undefined) =>
    path ? `https://image.tmdb.org/t/p/w92${path}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={() => !importing && step !== "searching" && step !== "importing" && onClose()}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col animate-fade-in overflow-hidden"
           style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {step === "review" && (
              <button
                onClick={() => setStep("input")}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Database className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-black text-white">
              {step === "input" && "Bulk Import"}
              {step === "searching" && "Searching TMDB…"}
              {step === "review" && "Review Results"}
              {step === "importing" && "Importing Items…"}
              {step === "completed" && "Finished!"}
            </h3>
            {step === "review" && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-full">
                  {readyCount} ready
                </span>
                {ambigCount > 0 && (
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-full">
                    {ambigCount} ambiguous groups
                  </span>
                )}
                {notFoundCount > 0 && (
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/15 rounded-full">
                    {notFoundCount} skipped
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={importing || step === "searching" || step === "importing"}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step: INPUT */}
        {step === "input" && (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto">
            {/* Format hint */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800/80 p-3 text-[10px] text-zinc-400 space-y-1 font-mono">
              <p className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-wider mb-1.5">Supported formats (one per line)</p>
              <p><span className="text-indigo-400">Inception</span> &nbsp;&nbsp;<span className="text-zinc-600">← title only</span></p>
              <p><span className="text-indigo-400">Breaking Bad, TV Show, Unwatched</span></p>
              <p><span className="text-indigo-400">Spirited Away, Anime, Watched</span></p>
              <p className="text-zinc-600 pt-1">Also works with tab-separated (paste from Google Sheets / Excel)</p>
            </div>

            {/* File upload */}
            <div>
              <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">Upload File (.txt / .csv)</p>
              <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-700 hover:border-indigo-500/60 hover:bg-indigo-500/5 rounded-xl text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Click to upload file, or paste titles below
              </button>
            </div>

            {/* Text area */}
            <div>
              <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1.5">
                Paste Titles
              </label>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={"Inception\nBreaking Bad, TV Show, Unwatched\nSpirited Away, Anime, Watched\nNaruto"}
                className="w-full h-44 text-xs font-medium bg-zinc-950 border border-zinc-800 focus:border-indigo-500/70 rounded-xl p-3 text-zinc-200 placeholder:text-zinc-650 focus:outline-none resize-none transition-colors"
              />
            </div>

            {/* Default status */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1.5">Default Status</label>
                <select
                  value={defaultWatched ? "watched" : "unwatched"}
                  onChange={(e) => setDefaultWatched(e.target.value === "watched")}
                  className="w-full text-xs font-semibold bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="unwatched">🍿 Default to Unwatched Queue</option>
                  <option value="watched">🎬 Default to Watched Collection</option>
                </select>
              </div>
            </div>

            {/* Failed & Rejected Imports collapsible history panel */}
            {failedHistory.length > 0 && (
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                    ⚠️ Failed & Skipped Imports Log ({failedHistory.length})
                  </span>
                  <div className="flex items-center gap-2 select-none">
                    <button
                      onClick={() => {
                        const allTitles = failedHistory.map((h) => h.title).join("\n");
                        setRawInput(allTitles);
                      }}
                      className="text-[9px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer bg-transparent border-none"
                      title="Paste all titles from history into text area to retry import"
                    >
                      📋 Copy all to Input
                    </button>
                    <span className="text-zinc-800 text-[10px]">|</span>
                    <button
                      onClick={() => {
                        setFailedHistory([]);
                        localStorage.removeItem("cinetrack_failed_imports");
                      }}
                      className="text-[9px] font-extrabold text-red-400/90 hover:text-red-300 transition-colors uppercase tracking-wider cursor-pointer bg-transparent border-none"
                    >
                      Clear Logs
                    </button>
                  </div>
                </div>
                
                <div className="max-h-28 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {failedHistory.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-zinc-900/60 border border-zinc-900 p-2.5 rounded-xl text-[10px]">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="font-bold text-zinc-200 truncate">{item.title}</p>
                        <p className="text-[8.5px] text-zinc-500 font-semibold mt-0.5">
                          {item.reason} • {item.timestamp}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (onSearchFailedTitle) {
                            onSearchFailedTitle(item.title);
                          }
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/15 rounded-lg text-[9px] font-bold tracking-wide transition-all cursor-pointer flex-shrink-0"
                        title="Populate global search with this title to manually import"
                      >
                        🔍 Search
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-450 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSearch}
                disabled={!rawInput.trim()}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                <FileText className="w-3.5 h-3.5" />
                Search {rawInput.trim() ? `${parseLines(rawInput).length} title${parseLines(rawInput).length !== 1 ? "s" : ""}` : "Titles"}
              </button>
            </div>
          </div>
        )}

        {/* Step: SEARCHING */}
        {step === "searching" && (
          <div className="flex flex-col items-center justify-center gap-6 p-12 text-center animate-fade-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-white mb-1">Searching TMDB</p>
              <p className="text-xs text-zinc-400 truncate max-w-xs font-semibold">
                &ldquo;{searchProgress.currentTitle}&rdquo;
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                <span>{searchProgress.current} of {searchProgress.total}</span>
                <span>{Math.round((searchProgress.current / searchProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: IMPORTING */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center gap-6 p-12 text-center animate-fade-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-white mb-1">Importing to Library</p>
              <p className="text-xs text-zinc-400 truncate max-w-xs font-semibold">
                &ldquo;{importProgress.currentTitle}&rdquo;
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                <span>{importProgress.current} of {importProgress.total}</span>
                <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: COMPLETED */}
        {step === "completed" && (
          <div className="flex flex-col items-center justify-center gap-6 p-12 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center scale-up">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white mb-1">Import Completed!</h3>
              <p className="text-xs text-zinc-400 font-semibold max-w-xs leading-relaxed">
                Successfully added <span className="text-emerald-400 font-black">{importedCount}</span> titles to your tracking list.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full max-w-xs py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 hover:text-black font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer active:scale-95 duration-150"
            >
              Done & Close
            </button>
          </div>
        )}

        {/* Step: REVIEW */}
        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">

              {/* FOUND SECTION */}
              {results.some((r) => r.status === "found") && (
                <section>
                  <div className="flex items-center gap-2 mb-3 select-none">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      Matches Found ({results.filter((r) => r.status === "found").length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {results.map((r, idx) => {
                      if (r.status !== "found") return null;
                      const item = r as FoundItem;
                      const poster = posterUrl(item.tmdbMovie.poster_path);
                      const year = item.tmdbMovie.release_date?.split("-")[0] || "";
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            item.selected
                              ? "bg-zinc-900 border-zinc-750"
                              : "bg-zinc-950/60 border-zinc-850 opacity-50"
                          }`}
                        >
                          {/* Selected Checkbox Toggle */}
                          <button
                            onClick={() => toggleFoundItemSelection(idx)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                              item.selected
                                ? "bg-indigo-500 border-indigo-500 text-zinc-950"
                                : "border-zinc-700 hover:border-zinc-500 text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          {/* Poster */}
                          <div className="w-9 h-12 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex-shrink-0 flex items-center justify-center">
                            {poster ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={poster} alt={item.tmdbMovie.title} className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-4 h-4 text-zinc-700" />
                            )}
                          </div>

                          {/* Title / Meta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-150 truncate leading-tight">
                              {item.tmdbMovie.title || item.tmdbMovie.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-[9px] font-semibold text-zinc-500">
                              {year && <span>{year}</span>}
                              {item.tmdbMovie.vote_average !== undefined && (
                                <span className="text-amber-500">⭐ {item.tmdbMovie.vote_average.toFixed(1)}</span>
                              )}
                              {item.tmdbMovie.category && (
                                <span className="bg-zinc-800/80 px-1 py-0.2 rounded text-[7.5px] uppercase tracking-wider text-zinc-400">
                                  {item.tmdbMovie.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[8px] text-zinc-600 mt-0.5">
                              Searched: &ldquo;{item.originalTitle}&rdquo;
                            </p>
                          </div>

                          {/* Individual Watched / Unwatched Toggle button */}
                          {item.selected && (
                            <button
                              onClick={() => toggleFoundItemWatched(idx)}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 cursor-pointer transition-all active:scale-95 duration-150 ${
                                item.watched
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-350 hover:bg-zinc-850"
                              }`}
                            >
                              {item.watched ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Watched</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 opacity-60" />
                                  <span>Unwatched</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* AMBIGUOUS SECTION */}
              {results.some((r) => r.status === "ambiguous") && (
                <section>
                  <div className="flex items-center gap-2 mb-3 select-none">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Ambiguous Matches — Select One or More Group
                    </h4>
                  </div>
                  <div className="space-y-4">
                    {results.map((r, idx) => {
                      if (r.status !== "ambiguous") return null;
                      const item = r as AmbiguousItem;
                      return (
                        <div key={idx} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4">
                          <div className="border-b border-zinc-900 pb-2 mb-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                              Search results for: &ldquo;{item.originalTitle}&rdquo;
                            </p>
                          </div>
                          <div className="space-y-2.5">
                            {item.options.map((opt, optIdx) => {
                              const poster = posterUrl(opt.tmdbMovie.poster_path);
                              const year = opt.tmdbMovie.release_date?.split("-")[0] || "";
                              return (
                                <div
                                  key={opt.tmdbMovie.id}
                                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                    opt.selected
                                      ? "bg-zinc-900 border-zinc-800"
                                      : "bg-zinc-950 border-transparent opacity-50"
                                  }`}
                                >
                                  {/* Checkbox to select */}
                                  <button
                                    onClick={() => toggleAmbiguousOptionSelection(idx, optIdx)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                                      opt.selected
                                        ? "bg-indigo-500 border-indigo-500 text-zinc-950"
                                        : "border-zinc-700 hover:border-zinc-500 text-transparent"
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </button>

                                  {/* Poster */}
                                  <div className="w-8 h-10 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {poster ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={poster} alt={opt.tmdbMovie.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <Film className="w-3.5 h-3.5 text-zinc-700" />
                                    )}
                                  </div>

                                  {/* Meta */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-zinc-200 truncate leading-tight">
                                      {opt.tmdbMovie.title || opt.tmdbMovie.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-semibold text-zinc-500">
                                      {year && <span>{year}</span>}
                                      {opt.tmdbMovie.vote_average !== undefined && (
                                        <span className="text-amber-500">⭐ {opt.tmdbMovie.vote_average.toFixed(1)}</span>
                                      )}
                                      {opt.tmdbMovie.category && (
                                        <span className="bg-zinc-800/80 px-1 py-0.2 rounded text-[7.5px] uppercase tracking-wider text-zinc-400">
                                          {opt.tmdbMovie.category}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Watched Status toggle per option */}
                                  {opt.selected && (
                                    <button
                                      onClick={() => toggleAmbiguousOptionWatched(idx, optIdx)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider border flex items-center gap-1 cursor-pointer transition-all active:scale-95 duration-150 ${
                                        opt.watched
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-350 hover:bg-zinc-850"
                                      }`}
                                    >
                                      {opt.watched ? (
                                        <>
                                          <Eye className="w-3 h-3" />
                                          <span>Watched</span>
                                        </>
                                      ) : (
                                        <>
                                          <EyeOff className="w-3 h-3 opacity-60" />
                                          <span>Unwatched</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* SKIPPED SECTION */}
              {results.some((r) => r.status === "not_found") && (
                <section>
                  <div className="flex items-center gap-2 mb-3 select-none">
                    <XCircle className="w-4 h-4 text-zinc-500" />
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-wider">
                      Skipped / Duplicate / Not Found ({results.filter((r) => r.status === "not_found").length})
                    </h4>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      The titles below were either not found on TMDB or are already in your library lists:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] font-semibold text-zinc-450">
                      {results.map((r, idx) => {
                        if (r.status !== "not_found") return null;
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-zinc-900/60 p-2 rounded-xl border border-zinc-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                            <span className="truncate">{r.originalTitle}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 flex-shrink-0">
              <p className="text-xs font-bold text-zinc-400">
                {readyCount} title{readyCount !== 1 ? "s" : ""} selected for import
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("input")}
                  className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={importing || readyCount === 0}
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-zinc-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  <Database className="w-3.5 h-3.5" />
                  Import {readyCount} Title{readyCount !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

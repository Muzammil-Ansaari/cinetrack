"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, PlayCircle, Clock, Calendar, Star, Film, ChevronRight, ChevronDown } from "lucide-react";

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  air_date: string;
  runtime: number;
  overview?: string;
}

interface Season {
  season_number: number;
  name: string;
  air_date: string;
  episodes: Episode[];
}

interface DetailData {
  title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_year: string;
  release_date?: string | null;
  runtime: number;
  global_rating: number | null;
  genres: string;
  trailerKey: string | null;
  seasonsWithEpisodes: Season[] | null;
  source: string;
  status?: string;
  upcomingSeason?: { season_number: number; name: string; air_date: string | null } | null;
  nextEpisode?: { season_number: number; episode_number: number; air_date: string } | null;
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: string;
  category: string;
}

export default function DetailModal({ isOpen, onClose, tmdbId, category }: DetailModalProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeasonTab, setActiveSeasonTab] = useState<number | null>(null);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    if (!isOpen || !tmdbId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setIsPlayingTrailer(false);
      setExpandedEpisodes({});

      try {
        const res = await fetch(`/api/details?id=${encodeURIComponent(tmdbId)}&category=${encodeURIComponent(category)}`);
        if (!res.ok) throw new Error("Failed to load details");
        const details = await res.json();
        setData(details);

        // Pre-select first season if available
        if (details.seasonsWithEpisodes && details.seasonsWithEpisodes.length > 0) {
          setActiveSeasonTab(details.seasonsWithEpisodes[0].season_number);
        }
      } catch (err: any) {
        console.error("Error loading show/movie details:", err);
        setError("Could not retrieve detailed information. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, tmdbId, category]);

  // Prevent scroll propagation on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleEpisodeExpand = (epId: number) => {
    setExpandedEpisodes((prev) => ({ ...prev, [epId]: !prev[epId] }));
  };

  const formatRuntime = (mins: number) => {
    if (mins <= 0) return "N/A";
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  };

  const formatFullReleaseDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return dateStr;
    return `${months[monthIndex]} ${parseInt(day, 10)}, ${year}`;
  };

  const renderRenewalStatus = () => {
    if (category !== "TV Show" && category !== "Anime") return null;
    
    const status = data?.status;
    const upcoming = data?.upcomingSeason;
    const nextEp = data?.nextEpisode;

    const isRenewed = status === "Returning Series" || 
                      status === "In Production" || 
                      status === "Planned" || 
                      status === "Running" ||
                      status === "In Development";

    if (upcoming) {
      const dateStr = upcoming.air_date
        ? `premieres on ${new Date(upcoming.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
        : "is upcoming / in production";

      return (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-400 select-none animate-pulse">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] mr-1 bg-emerald-500/25 px-1.5 py-0.5 rounded text-white">Renewed</span>
            <span className="font-medium text-zinc-300">
              <strong>{upcoming.name}</strong> {dateStr}!
            </span>
          </div>
        </div>
      );
    }

    if (nextEp) {
      return (
        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-indigo-400 select-none">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] mr-1 bg-indigo-500/25 px-1.5 py-0.5 rounded text-white">Next Episode</span>
            <span className="font-medium text-zinc-300">
              S{nextEp.season_number}E{nextEp.episode_number} airs on {new Date(nextEp.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}!
            </span>
          </div>
        </div>
      );
    }

    if (isRenewed) {
      return (
        <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-400/80 select-none">
          <span className="h-2 w-2 rounded-full bg-emerald-500/60"></span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] mr-1 bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">Active Show</span>
            <span className="font-medium text-zinc-400">Renewed for future installments.</span>
          </div>
        </div>
      );
    }

    if (status === "Ended") {
      return (
        <div className="mt-4 p-3 bg-zinc-900/50 border border-zinc-850 rounded-2xl flex items-center gap-2.5 text-xs text-zinc-500 select-none">
          <span className="h-2 w-2 rounded-full bg-zinc-700"></span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] mr-1 bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Ended</span>
            <span className="font-medium text-zinc-500">This series has concluded.</span>
          </div>
        </div>
      );
    }

    if (status === "Canceled") {
      return (
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-2.5 text-xs text-red-400/85 select-none">
          <span className="h-2 w-2 rounded-full bg-red-500/60"></span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] mr-1 bg-red-500/20 px-1.5 py-0.5 rounded text-red-300">Canceled</span>
            <span className="font-medium text-zinc-400">This show was canceled by the network.</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-fade-in">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl h-[90vh] bg-zinc-950 border border-zinc-850 rounded-3xl overflow-hidden flex flex-col shadow-2xl ring-1 ring-zinc-800/40">
        
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/60 hover:bg-black/80 text-zinc-400 hover:text-white rounded-full border border-zinc-800/80 transition-all cursor-pointer shadow-lg active:scale-90"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-550">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Retrieving details...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-zinc-200">Retrieval Failed</h3>
            <p className="text-xs text-zinc-500 max-w-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : data ? (
          <div className="flex-grow overflow-y-auto scrollbar-none flex flex-col">
            
            {/* Hero Backdrop / Player Banner */}
            <div className="relative w-full h-[240px] sm:h-[350px] bg-zinc-900 flex-shrink-0 border-b border-zinc-900 overflow-hidden select-none">
              {isPlayingTrailer && data.trailerKey ? (
                <div className="w-full h-full relative bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${data.trailerKey}?autoplay=1&rel=0`}
                    title={`${data.title} Official Trailer`}
                    className="w-full h-full border-none absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <button
                    onClick={() => setIsPlayingTrailer(false)}
                    className="absolute bottom-4 right-4 z-40 px-3 py-1.5 bg-black/75 hover:bg-black/90 text-zinc-250 hover:text-white border border-zinc-800 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    Close Trailer
                  </button>
                </div>
              ) : (
                <>
                  {data.backdrop_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.backdrop_path}
                      alt={data.title}
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/20 via-zinc-900 to-purple-950/20 flex flex-col items-center justify-center text-zinc-700 p-4">
                      <Film className="w-12 h-12 mb-2 opacity-20" />
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-650">No Backdrop Available</span>
                    </div>
                  )}

                  {/* Backdrop Bottom Dark Linear Fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

                  {/* Trailer Overlay Kicker */}
                  {data.trailerKey && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={() => setIsPlayingTrailer(true)}
                        className="flex items-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl active:scale-95 transition-all cursor-pointer text-sm font-extrabold tracking-wide border border-indigo-500/35 hover:shadow-indigo-500/20 group"
                      >
                        <PlayCircle className="w-5 h-5 text-white group-hover:scale-105 transition-transform" />
                        <span>Watch Trailer</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Content Details Block */}
            <div className="px-6 pb-12 flex flex-col md:flex-row gap-6 relative -mt-16 z-30">
              
              {/* Left Column: Poster Panel */}
              <div className="w-[120px] md:w-[170px] flex-shrink-0 select-none mx-auto md:mx-0">
                <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl flex items-center justify-center relative">
                  {data.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.poster_path}
                      alt={data.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center p-4 text-zinc-700">
                      <Film className="w-8 h-8 mb-1 opacity-20" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">No Poster</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Information Sheet */}
              <div className="flex-grow min-w-0 flex flex-col pt-3 md:pt-16">
                
                {/* Movie Header */}
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight select-text">
                  {data.title}
                </h1>

                {/* Badges/Details row */}
                <div className="flex flex-wrap items-center gap-2 mt-2 select-none text-[10px] font-extrabold text-zinc-500">
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded uppercase">
                    {category}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" /> {formatFullReleaseDate(data.release_date) || data.release_year}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-zinc-400">
                    <Clock className="w-3.5 h-3.5" /> {formatRuntime(data.runtime)}
                  </span>
                  {data.global_rating !== null && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-500" /> {data.global_rating.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                {/* Genres */}
                {data.genres && (
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mt-2">
                    {data.genres.split(", ").join(" • ")}
                  </p>
                )}

                {/* Synopsis */}
                {data.overview && (
                  <div className="mt-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Synopsis</h3>
                    <p className="text-xs text-zinc-450 leading-relaxed mt-1 select-text">
                      {data.overview}
                    </p>
                  </div>
                )}



                {/* Renewal/Upcoming Season Status Kicker */}
                {renderRenewalStatus()}

                {/* Seasons & Episodes Explorer */}
                {data.seasonsWithEpisodes && data.seasonsWithEpisodes.length > 0 && (
                  <div className="mt-8 border-t border-zinc-900 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">Season & Episode Explorer</h3>
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-850">
                        {data.seasonsWithEpisodes.length} {data.seasonsWithEpisodes.length === 1 ? "Season" : "Seasons"} Available
                      </span>
                    </div>

                    {/* Season Navigation Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none">
                      {data.seasonsWithEpisodes.map((season) => (
                        <button
                          key={season.season_number}
                          onClick={() => setActiveSeasonTab(season.season_number)}
                          className={`px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 duration-200 flex-shrink-0 ${
                            activeSeasonTab === season.season_number
                              ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/10"
                              : "bg-zinc-900/50 border border-zinc-850/60 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {season.name} ({season.episodes.length} eps)
                        </button>
                      ))}
                    </div>

                    {/* Episode List Accordion */}
                    <div className="mt-4 divide-y divide-zinc-900 border border-zinc-900 bg-zinc-950/40 rounded-2xl overflow-hidden">
                      {data.seasonsWithEpisodes
                        .find((s) => s.season_number === activeSeasonTab)
                        ?.episodes.map((ep) => {
                          const isExpanded = !!expandedEpisodes[ep.id];
                          const epRuntimeFormatted = ep.runtime ? `${ep.runtime}m` : "";

                          return (
                            <div key={ep.id} className="w-full transition-colors duration-250">
                              {/* Accordion Trigger row */}
                              <button
                                onClick={() => toggleEpisodeExpand(ep.id)}
                                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-zinc-900/30 transition-all cursor-pointer group"
                              >
                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                  <span className="w-6 text-[10px] font-black text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 text-center py-0.5 rounded flex-shrink-0">
                                    E{ep.episode_number}
                                  </span>
                                  <span className="text-xs font-extrabold text-zinc-250 truncate group-hover:text-white transition-colors">
                                    {ep.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 select-none">
                                  {epRuntimeFormatted && (
                                    <span className="text-[10px] text-zinc-550 font-bold flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" /> {epRuntimeFormatted}
                                    </span>
                                  )}
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-350" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-350" />
                                  )}
                                </div>
                              </button>

                              {/* Episode Expandable Overview */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-1 border-t border-zinc-900 bg-zinc-950/60 animate-fade-in select-text">
                                  {ep.air_date && ep.air_date !== "N/A" && (
                                    <p className="text-[9px] font-extrabold text-zinc-550 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                      📅 Aired on {new Date(ep.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-zinc-450 leading-relaxed font-medium">
                                    {ep.overview || "No description available for this episode."}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        ) : null}

      </div>
    </div>
  );
}

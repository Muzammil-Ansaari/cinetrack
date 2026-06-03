"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Film,
  RefreshCw,
  Database,
  Cloud,
  LayoutDashboard,
  Compass,
  Trophy,
  History,
  Search,
  Loader2,
  Users,
  LogOut,
  Bell,
  X,
  Plus,
  Check,
  Tv,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shield
} from "lucide-react";
import { Movie, TMDBMovie } from "@/types";
// Supabase deprecated, utilizing native MongoDB operations
import StatsPanel from "@/components/StatsPanel";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import AuthPage from "@/components/AuthPage";
import FriendsPanel from "@/components/FriendsPanel";
import { useAuth } from "@/lib/AuthContext";
import BulkImportModal from "@/components/BulkImportModal";
import CustomMovieModal from "@/components/CustomMovieModal";
import DetailModal from "@/components/DetailModal";
import AdminPanel from "@/components/AdminPanel";

interface ActivityLog {
  id: string;
  type: "add" | "watch" | "unwatch" | "delete" | "rate" | "review" | "decline" | "undecline";
  title: string;
  category: string;
  timestamp: string;
  details: string;
  user_id?: string;
  username?: string;
}

// Inner dashboard — only rendered when user is authenticated
function DashboardInner() {
  const {
    user,
    profile,
    friends: authFriends,
    pendingRequests,
    signOut,
    loading: authLoading,
  } = useAuth();
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "unwatched" | "upcoming_watchlist" | "watched" | "declined" | "search_results" | "admin">("dashboard");
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);
  const [isCustomMovieModalOpen, setIsCustomMovieModalOpen] = useState(false);
  
  // Dedicated Search Tab States
  const [searchTabQuery, setSearchTabQuery] = useState("");
  const [searchTabResults, setSearchTabResults] = useState<TMDBMovie[]>([]);
  const [searchTabLoading, setSearchTabLoading] = useState(false);
  const [searchTabPage, setSearchTabPage] = useState(1);
  const [searchTabTotalPages, setSearchTabTotalPages] = useState(5);

  // Detail Modal States
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalTmdbId, setDetailModalTmdbId] = useState("");
  const [detailModalCategory, setDetailModalCategory] = useState("Movie");

  const openDetailModal = useCallback((tmdbId: string, category: string) => {
    setDetailModalTmdbId(tmdbId);
    setDetailModalCategory(category);
    setDetailModalOpen(true);
  }, []);

  // Showcase Sections
  const [trendingTodaySection, setTrendingTodaySection] = useState<any[]>([]);
  const [trendingWeekSection, setTrendingWeekSection] = useState<any[]>([]);
  const [nextWeekSection, setNextWeekSection] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSections = async () => {
      if (activeTab !== "dashboard") return;
      setSectionsLoading(true);
      try {
        const [todayRes, weekRes, nextWeekRes] = await Promise.all([
          fetch("/api/tmdb?section=trending_today"),
          fetch("/api/tmdb?section=trending_week"),
          fetch("/api/tmdb?section=next_week"),
        ]);

        if (!active) return;

        if (todayRes.ok) {
          const d = await todayRes.json();
          setTrendingTodaySection(d.results || []);
        }
        if (weekRes.ok) {
          const d = await weekRes.json();
          setTrendingWeekSection(d.results || []);
        }
        if (nextWeekRes.ok) {
          const d = await nextWeekRes.json();
          setNextWeekSection(d.results || []);
        }
      } catch (e) {
        console.error("Failed to load dashboard showcase sections:", e);
      } finally {
        if (active) {
          setSectionsLoading(false);
        }
      }
    };

    fetchSections();

    return () => {
      active = false;
    };
  }, [activeTab]);

  const renderShowcaseRow = (title: string, items: any[], iconEmoji: string, showDateOnly = false) => {
    if (items.length === 0) return null;
    const rowId = `showcase-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

    return (
      <div className="flex flex-col gap-3 select-none mt-2 relative group/row">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <span>{iconEmoji}</span> {title}
          </h3>
        </div>

        {/* Left scroll chevron */}
        <button
          onClick={() => {
            const el = document.getElementById(rowId);
            if (el) el.scrollBy({ left: -400, behavior: "smooth" });
          }}
          className="absolute left-1 top-[45%] -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-zinc-800 text-zinc-400 hover:text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hidden md:block cursor-pointer"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right scroll chevron */}
        <button
          onClick={() => {
            const el = document.getElementById(rowId);
            if (el) el.scrollBy({ left: 400, behavior: "smooth" });
          }}
          className="absolute right-1 top-[45%] -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-zinc-800 text-zinc-400 hover:text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hidden md:block cursor-pointer"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scrollable Container (Grid on mobile, horizontal scroll on desktop) */}
        <div
          id={rowId}
          className="grid grid-cols-2 md:flex md:items-stretch gap-3 md:gap-4 md:overflow-x-auto pb-4 pt-1 md:scrollbar-none md:scroll-smooth"
        >
          {items.map((item) => {
            const year = item.release_date ? item.release_date.split("-")[0] : "N/A";
            const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const posterUrl = item.poster_path
              ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
              : "";
            const itemTracked = isTracked(item.id.toString());
            const formattedReleaseDate = item.release_date
              ? new Date(item.release_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "";

            return (
              <div 
                key={item.id} 
                className="w-full md:w-[180px] md:flex-shrink-0 bg-zinc-900/50 border border-zinc-800/70 hover:border-indigo-500/30 rounded-2xl overflow-hidden flex flex-col justify-between shadow-md hover:shadow-indigo-500/5 transition-all duration-300 group relative"
              >
                {/* Poster Image / Click Trigger */}
                <div 
                  onClick={() => openDetailModal(item.id.toString(), item.category || "Movie")}
                  className="w-full aspect-[2/3] bg-zinc-950 overflow-hidden relative cursor-pointer active:scale-95 transition-all"
                  title="Click to view details & trailer"
                >
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center p-3 text-zinc-700 bg-zinc-950">
                      <Film className="w-6 h-6 mb-1 opacity-20" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">No Poster</span>
                    </div>
                  )}

                  {/* Category Badge */}
                  {item.category && (
                    <span className={`absolute top-2 left-2 px-1.5 py-0.5 border text-[7px] font-extrabold uppercase rounded-md tracking-wider backdrop-blur-sm select-none ${
                      item.category === "Anime"
                        ? "bg-purple-500/20 border-purple-500/30 text-purple-400"
                        : item.category === "TV Show"
                        ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                        : item.category === "Animated Movie"
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                        : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                    }`}>
                      {item.category}
                    </span>
                  )}

                  {/* Hover Synopsis Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <p className="text-[8.5px] font-medium text-zinc-300 line-clamp-4 leading-relaxed">
                      {item.overview || "No description available."}
                    </p>
                  </div>
                </div>

                {/* Info Block */}
                <div className="p-3 flex flex-col gap-2">
                  <div>
                    <h4 
                      onClick={() => openDetailModal(item.id.toString(), item.category || "Movie")}
                      className="text-[11.5px] font-extrabold text-zinc-100 line-clamp-2 leading-snug cursor-pointer hover:text-indigo-400 transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-1.5 text-[9px] font-semibold text-zinc-500">
                      {showDateOnly ? (
                        <span className="text-indigo-400 font-extrabold">{formattedReleaseDate}</span>
                      ) : (
                        <span>{year}</span>
                      )}
                      {rating !== "N/A" && rating !== "0.0" && (
                        <span className="text-amber-400 font-bold">⭐ {rating}</span>
                      )}
                    </div>
                  </div>

                  {/* Add / Tracked button */}
                  {itemTracked ? (
                    <div className="w-full py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1 select-none">
                      <Check className="w-3 h-3 text-indigo-400" /> Tracked
                    </div>
                  ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const movieObj: TMDBMovie = {
                          id: item.id,
                          title: item.title,
                          poster_path: item.poster_path,
                          backdrop_path: item.backdrop_path,
                          release_date: item.release_date,
                          vote_average: item.vote_average,
                          overview: item.overview,
                          media_type: item.media_type,
                          category: item.category,
                          seasons: null,
                        };
                        await handleAddMovie(movieObj, false);
                      }}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 border border-indigo-500/20"
                    >
                      <Plus className="w-3 h-3" /> Add to List
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleSearchSubmit = useCallback(async (query: string, pageNum = 1) => {
    if (!query.trim()) return;
    setSearchTabQuery(query);
    setSearchTabPage(pageNum);
    setSearchTabLoading(true);
    setActiveTab("search_results");
    
    try {
      const res = await fetch(`/api/tmdb?query=${encodeURIComponent(query.trim())}&page=${pageNum}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      
      if (data.results) {
        setSearchTabResults(data.results);
        setSearchTabTotalPages(5); // Show pagination for up to 5 full pages of results
      } else {
        setSearchTabResults([]);
        setSearchTabTotalPages(1);
      }
    } catch (e) {
      console.error("Full Search tab error:", e);
      setToast({ message: "Could not retrieve search results.", type: "warning" });
    } finally {
      setSearchTabLoading(false);
    }
  }, []);

  // Bulk Import States
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  
  // Local filters for the lists tabs
  const [unwatchedFilter, setUnwatchedFilter] = useState("");
  const [watchedFilter, setWatchedFilter] = useState("");
  const [declinedFilter, setDeclinedFilter] = useState("");
  const [unwatchedGenreFilter, setUnwatchedGenreFilter] = useState("");
  const [watchedGenreFilter, setWatchedGenreFilter] = useState("");
  const [unwatchedCategoryFilter, setUnwatchedCategoryFilter] = useState("");
  const [watchedCategoryFilter, setWatchedCategoryFilter] = useState("");

  const [upcomingFilter, setUpcomingFilter] = useState("");
  const [upcomingGenreFilter, setUpcomingGenreFilter] = useState("");
  const [upcomingCategoryFilter, setUpcomingCategoryFilter] = useState("");

  // Date range filters
  const [unwatchedDatePreset, setUnwatchedDatePreset] = useState("all");
  const [unwatchedStartDate, setUnwatchedStartDate] = useState("");
  const [unwatchedEndDate, setUnwatchedEndDate] = useState("");

  const [watchedDatePreset, setWatchedDatePreset] = useState("all");
  const [watchedStartDate, setWatchedStartDate] = useState("");
  const [watchedEndDate, setWatchedEndDate] = useState("");

  const [upcomingDatePreset, setUpcomingDatePreset] = useState("all");
  const [upcomingStartDate, setUpcomingStartDate] = useState("");
  const [upcomingEndDate, setUpcomingEndDate] = useState("");

  // Recent Activity Feed
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // Real-time synchronization is handled via HTTP polling
  const broadcastMovieChange = useCallback(() => {
    // Deprecated with Supabase drop. Sync is managed via HTTP polling
  }, []);

  const ensureFreshSession = async () => {
    // Deprecated with Supabase drop. Session verification uses custom HTTP cookies.
    return null;
  };

  // Collaborative Co-Watching — use real auth friends (display names) + self
  // Collaborative Co-Watching — use real auth friends (display names) + self
  const myName = user?.display_name || user?.username || "Me";

  // Helper to convert user_id to display name
  const getUserNameById = useCallback((uid?: string | null) => {
    if (!uid) return "Unknown";
    if (uid === user?.id) return myName;
    const friend = authFriends.find((f) => f.id === uid);
    return friend ? (friend.display_name || friend.username) : "Friend";
  }, [user?.id, myName, authFriends]);

  // Helper to map username or display name to their UUID
  const getUserIdByName = useCallback((name: string) => {
    if (!name) return null;
    if (name === myName || name.toLowerCase() === "me" || name.toLowerCase() === "my list" || name.toLowerCase() === "my watch list") {
      return user?.id;
    }
    const friend = authFriends.find((f) => 
      (f.display_name || "").toLowerCase() === name.toLowerCase() ||
      (f.username || "").toLowerCase() === name.toLowerCase()
    );
    return friend ? friend.id : null;
  }, [myName, user?.id, authFriends]);

  const isMovieOwnedByUser = useCallback((m: Movie, name: string) => {
    const targetUserId = getUserIdByName(name);
    
    // 1. Check by user_id in owner_ids
    if (targetUserId && m.owner_ids) {
      const ownerIds = m.owner_ids.split(", ").filter(Boolean);
      if (ownerIds.includes(targetUserId)) return true;
    }
    
    // 2. Check by name in owners field (case-insensitive)
    if (m.owners) {
      const owners = m.owners.split(", ").map(o => o.trim().toLowerCase()).filter(Boolean);
      if (owners.includes(name.toLowerCase())) return true;
    }
    
    // 3. Check by name in reviews_json (legacy fallback)
    if (m.reviews_json) {
      const reviews = m.reviews_json.split(", ").map(r => r.trim().toLowerCase()).filter(Boolean);
      if (reviews.includes(name.toLowerCase())) return true;
    }
    
    // 4. Check if the canonical movie's user_id maps to this user name
    const canonicalOwner = getUserNameById(m.user_id);
    if (canonicalOwner.toLowerCase() === name.toLowerCase()) return true;

    return false;
  }, [getUserIdByName, getUserNameById]);

  const isMovieWatchedByUser = useCallback((m: Movie, name: string) => {
    const targetUserId = getUserIdByName(name);
    if (targetUserId && m.watched_by_ids) {
      const watchedIds = m.watched_by_ids.split(", ").filter(Boolean);
      if (watchedIds.includes(targetUserId)) return true;
    }
    if (m.watched_by) {
      const watched = m.watched_by.split(", ").map(w => w.trim().toLowerCase()).filter(Boolean);
      if (watched.includes(name.toLowerCase())) return true;
    }
    return false;
  }, [getUserIdByName]);

  const isMovieDeclinedByUser = useCallback((m: Movie, name: string) => {
    const targetUserId = getUserIdByName(name);
    if (targetUserId && m.declined_by_ids) {
      const declinedIds = m.declined_by_ids.split(", ").filter(Boolean);
      if (declinedIds.includes(targetUserId)) return true;
    }
    if (m.declined_by) {
      const declined = m.declined_by.split(", ").map(d => d.trim().toLowerCase()).filter(Boolean);
      if (declined.includes(name.toLowerCase())) return true;
    }
    return false;
  }, [getUserIdByName]);

  // Fetch movies for ALL accepted friends so we can browse their queues
  const coWatchGroupUserIds = useMemo(() => {
    return [user?.id, ...authFriends.map((f) => f.id)].filter(Boolean) as string[];
  }, [user?.id, authFriends]);

  // friends = display names for list tabs: Me + all accepted friends
  const friends = useMemo(() => {
    return [myName, ...authFriends.map((f) => f.display_name || f.username)];
  }, [myName, authFriends]);

  const [watchedViewMode, setWatchedViewMode] = useState<string>("my-list");
  const [unwatchedViewMode, setUnwatchedViewMode] = useState<string>("my-list");
  const [upcomingViewMode, setUpcomingViewMode] = useState<string>("my-list");





  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);



  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    setToast({ message, type });
  };

  // 🔴 Refetch activities from MongoDB API endpoint
  const refetchActivities = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/activities?userIds=${encodeURIComponent(coWatchGroupUserIds.join(","))}`);
      if (!response.ok) throw new Error("Failed to fetch activities from MongoDB");
      const { results } = await response.json();
      if (results) {
        setActivities(results);
      }
    } catch (err) {
      console.error("Failed to refetch activities from MongoDB:", err);
    }
  }, [user?.id, coWatchGroupUserIds]);

  // 🔴 Refetch movies from MongoDB API endpoint — keep rows per user (no merging)
  const refetchMovies = useCallback(async () => {
    if (!user) return;
    try {
      refetchActivities();
      const response = await fetch(`/api/movies?userIds=${encodeURIComponent(coWatchGroupUserIds.join(","))}`);
      if (!response.ok) throw new Error("Failed to fetch movies from MongoDB");
      const { results } = await response.json();
      if (!results) return;

      // Keep each DB row as its own Movie entry with the original user_id.
      // This means your rows stay yours, friend rows stay theirs.
      // The view-mode filters (isMovieOwnedByUser etc.) handle display correctly.
      const normalizedMovies: Movie[] = (results as Movie[]).map((row: Movie) => {
        const ownerName = getUserNameById(row.user_id);
        // Populate watched_by / declined_by so filter helpers can work on single rows
        const watchedBy   = row.watched  ? ownerName : (row.watched_by  || "");
        const declinedBy  = row.declined ? ownerName : (row.declined_by || "");
        const watchedByIds   = row.watched  ? (row.user_id || "") : (row.watched_by_ids  || "");
        const declinedByIds  = row.declined ? (row.user_id || "") : (row.declined_by_ids || "");

        return {
          ...row,
          watched_by:      watchedBy,
          declined_by:     declinedBy,
          watched_by_ids:  watchedByIds,
          declined_by_ids: declinedByIds,
          // Ensure the "Added by" label is resolved from user_id
          reviews_json: row.reviews_json || ownerName,
          owners:       row.owners       || ownerName,
        };
      });

      // Newest additions first
      normalizedMovies.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      setMovies(normalizedMovies);
      localStorage.setItem("cinetrack_movies_cache", JSON.stringify(normalizedMovies));
    } catch (e) {
      console.error("CineTrack [MongoDB GET Error]:", e);
    }
  }, [user?.id, coWatchGroupUserIds, refetchActivities, getUserNameById]);

  // Keep a ref to the latest refetchMovies to avoid resubscribing on every memo change
  const refetchRef = useRef(refetchMovies);
  useEffect(() => {
    refetchRef.current = refetchMovies;
  }, [refetchMovies]);

  // Load Movies and Activities on mount / when user or friends change
  useEffect(() => {
    async function loadData() {
      // Optimistically load from localStorage cache first so dashboard opens with content instantly
      const cached = localStorage.getItem("cinetrack_movies_cache");
      if (cached) {
        try {
          setMovies(JSON.parse(cached));
        } catch (e) {
          console.error("Failed parsing movies cache:", e);
        }
      }

      // If we don't have cached movies, we show a nice skeleton spinner during the first load
      if (!cached) {
        setLoading(true);
      }

      try {
        if (user) {
          await refetchRef.current();
          // Silently trigger background migration to fix TV show runtimes and episode counts
          fetch("/api/movies?migrate=true")
            .then(res => {
              if (res.ok) return res.json();
            })
            .then(data => {
              if (data?.migrated && data.migrated.length > 0) {
                console.log("CineTrack: TV Show data migration successfully finished!", data.migrated);
                refetchRef.current(); // Refresh page data to reflect migrated TV show details
              }
            })
            .catch(err => console.warn("CineTrack Migration Background Error:", err));
        } else {
          const localData = localStorage.getItem(`cinetrack_movies_local`);
          setMovies(localData ? JSON.parse(localData) : []);
          
          const localActs = localStorage.getItem("cinetrack_activities");
          setActivities(localActs ? JSON.parse(localActs) : []);
        }
      } catch (err: any) {
        console.error("Failed to load movies or history:", err);
        showToast("Error loading tracker state.", "warning");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, `${coWatchGroupUserIds.join(",")}:${friends.join(",")}`]);

  // 🔴 Sync database when the browser tab becomes active again
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("CineTrack: tab resumed. Syncing database...");
        refetchRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  // 🔄 Real-time database sync: poll every 6 seconds if tab is active
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refetchRef.current();
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [user?.id]);



  // Save changes helper (synces back locally if Supabase is disabled)
  const saveMoviesState = async (newMovies: Movie[]) => {
    setMovies(newMovies);
    localStorage.setItem(`cinetrack_movies_${user?.id || "local"}`, JSON.stringify(newMovies));
  };

  // Add a new activity log
  const logActivity = async (type: ActivityLog["type"], title: string, category: string, details: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      category,
      timestamp: new Date().toISOString(),
      details,
      user_id: user?.id || "local",
      username: myName
    };
    const updated = [newLog, ...activities].slice(0, 30);
    setActivities(updated);

    if (user) {
      try {
        await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newLog)
        });
      } catch (err) {
        console.error("Failed to save activity to MongoDB:", err);
      }
    } else {
      localStorage.setItem("cinetrack_activities", JSON.stringify(updated));
    }
  };

  // Helper to format activity timestamps relative to now
  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Helper to check if a specific TMDB movie is already tracked
  const isTracked = (tmdbId: string) => {
    return movies.some((m) => m.tmdb_id === tmdbId);
  };






  // 1. Add Movie operation
  const handleAddMovie = async (tmdbMovie: TMDBMovie, watched: boolean) => {
    console.log("CineTrack [Diagnostics]: handleAddMovie triggered", { 
      title: tmdbMovie.title, 
      id: tmdbMovie.id, 
      media_type: tmdbMovie.media_type,
      category: tmdbMovie.category,
      watched 
    });

    try {
      console.log("CineTrack [Diagnostics]: Checking session freshness...");
      await ensureFreshSession();
      console.log("CineTrack [Diagnostics]: Session freshness checked.");

      if (movies.some((m) => m.tmdb_id === tmdbMovie.id.toString())) {
        console.warn("CineTrack [Diagnostics]: Movie is already in local list:", tmdbMovie.title);
        showToast(`"${tmdbMovie.title}" is already in your tracker!`, "info");
        return;
      }

      let runtime = 120;
      let seasons: number | null = null;
      let episodes: number | null = null;
      let category = tmdbMovie.category || "Movie";
      let global_rating: number | null = tmdbMovie.vote_average || null;
      let genres: string | null = null;
      let releaseDate = tmdbMovie.release_date || null;

      try {
        console.log("CineTrack [Diagnostics]: Fetching details from TMDB proxy...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn("CineTrack [Diagnostics]: TMDB proxy request timed out after 4 seconds.");
          controller.abort();
        }, 4000); // 4-second timeout limit

        const resolvedMediaType = tmdbMovie.media_type || 
          ((category === "TV Show" || category === "Anime") ? "tv" : "movie");

        const detailsRes = await fetch(
          `/api/tmdb?movieId=${tmdbMovie.id}&mediaType=${resolvedMediaType}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        console.log("CineTrack [Diagnostics]: TMDB details fetch finished with HTTP:", detailsRes.status);

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          console.log("CineTrack [Diagnostics]: TMDB details parsed successfully:", detailsData);
          if (detailsData.runtime) {
            runtime = detailsData.runtime;
          }
          if (detailsData.seasons !== undefined) {
            seasons = detailsData.seasons;
          }
          if (detailsData.number_of_episodes !== undefined) {
            episodes = detailsData.number_of_episodes;
          }
          if (detailsData.category) {
            category = detailsData.category;
          }
          if (detailsData.vote_average !== undefined) {
            global_rating = detailsData.vote_average;
          }
          if (detailsData.genres) {
            genres = detailsData.genres.map((g: any) => g.name).join(", ");
          }
          if (detailsData.release_date || detailsData.first_air_date) {
            releaseDate = detailsData.release_date || detailsData.first_air_date;
          }
        } else {
          console.warn("CineTrack [Diagnostics]: TMDB proxy responded with non-200 status:", detailsRes.status);
        }
      } catch (err) {
        console.warn("CineTrack [Diagnostics]: Failed to fetch details, falling back to standard search metadata", err);
      }

      console.log("CineTrack [Diagnostics]: Constructing new database entry...");
      const newEntry: Movie = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        tmdb_id: tmdbMovie.id.toString(),
        title: tmdbMovie.title,
        poster_path: tmdbMovie.poster_path,
        backdrop_path: tmdbMovie.backdrop_path,
        release_year: releaseDate ? releaseDate.split("-")[0] : "N/A",
        release_date: releaseDate,
        runtime,
        synopsis: tmdbMovie.overview || null,
        watched,
        rating: null,
        review: null,
        seasons,
        episodes,
        category,
        global_rating,
        genres,
        watched_by: watched ? myName : "",
        ratings_json: "{}",
        owners: myName,
        reviews_json: myName,
        user_id: user?.id || null,
        created_at: new Date().toISOString(),
        watched_at: watched ? new Date().toISOString() : null,
      };
      console.log("CineTrack [Diagnostics]: New entry object prepared:", newEntry);

      // 🟢 Save new record to MongoDB
      console.log("CineTrack [Diagnostics]: Saving new record to MongoDB...");
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save movie to MongoDB");
      }
      console.log("CineTrack [Diagnostics]: MongoDB insert operation succeeded!");

      console.log("CineTrack [Diagnostics]: Updating client state...");
      const updatedMovies = [newEntry, ...movies];
      await saveMoviesState(updatedMovies);
      
      console.log("CineTrack [Diagnostics]: Triggering refetchMovies...");
      await refetchMovies();
      console.log("CineTrack [Diagnostics]: refetchMovies completed.");

      // Real-time broadcast to friends
      broadcastMovieChange();
      
      // Log Activity
      logActivity(
        "add", 
        tmdbMovie.title, 
        category, 
        watched ? "added it to Watched list" : "added it to Unwatched list"
      );

      console.log("CineTrack [Diagnostics]: Adding movie successful!");
      showToast(
        `Added "${tmdbMovie.title}" to ${watched ? "Watched Collection" : "Unwatched Queue"}!`,
        "success"
      );
    } catch (err: any) {
      console.error("CineTrack [Diagnostics]: Uncaught error inside handleAddMovie:", err);
      showToast(`Error: ${err?.message || "Could not save movie. Try again later."}`, "warning");
    }
  };

  const handleBulkImportConfirm = async (
    items: { tmdbMovie: TMDBMovie; watched: boolean }[],
    onProgress: (current: number, total: number, title: string) => void
  ): Promise<number> => {
    if (items.length === 0) return 0;

    await ensureFreshSession();
    let successCount = 0;
    const importedEntries: Movie[] = [];

    // Deduplicate items list to be imported by tmdbMovie.id first
    const uniqueItemsMap = new Map<number, { tmdbMovie: TMDBMovie; watched: boolean }>();
    for (const item of items) {
      uniqueItemsMap.set(item.tmdbMovie.id, item);
    }
    const finalItems = Array.from(uniqueItemsMap.values());

    for (let i = 0; i < finalItems.length; i++) {
      const { tmdbMovie, watched } = finalItems[i];
      const title = tmdbMovie.title || tmdbMovie.name || "Untitled Movie";

      // Notify progress tracker
      onProgress(i + 1, finalItems.length, title);

      // Skip duplicates already tracked in state
      if (movies.some((m) => m.tmdb_id === tmdbMovie.id.toString())) {
        continue;
      }

      let runtime = 120;
      let seasons: number | null = tmdbMovie.seasons || null;
      let episodes: number | null = tmdbMovie.episodes || null;
      let category = tmdbMovie.category || "Movie";
      let global_rating: number | null = tmdbMovie.vote_average || null;
      let genres: string | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout limit per fetch

        const resolvedMediaType = tmdbMovie.media_type || 
          ((category === "TV Show" || category === "Anime") ? "tv" : "movie");

        const detailsRes = await fetch(
          `/api/tmdb?movieId=${tmdbMovie.id}&mediaType=${resolvedMediaType}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.runtime) runtime = detailsData.runtime;
          if (detailsData.seasons !== undefined) seasons = detailsData.seasons;
          if (detailsData.number_of_episodes !== undefined) episodes = detailsData.number_of_episodes;
          if (detailsData.category) category = detailsData.category;
          if (detailsData.vote_average !== undefined) global_rating = detailsData.vote_average;
          if (detailsData.genres) {
            genres = detailsData.genres.map((g: any) => g.name).join(", ");
          }
        }
      } catch (detailErr) {
        console.warn(`Failed details fetch for bulk item ${title}`, detailErr);
      }

      const newEntry: Movie = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        tmdb_id: tmdbMovie.id.toString(),
        title: title,
        poster_path: tmdbMovie.poster_path,
        backdrop_path: tmdbMovie.backdrop_path,
        release_year: tmdbMovie.release_date ? tmdbMovie.release_date.split("-")[0] : "N/A",
        runtime,
        synopsis: tmdbMovie.overview || null,
        watched,
        rating: null,
        review: null,
        seasons,
        episodes,
        category,
        global_rating,
        genres,
        watched_by: watched ? myName : "",
        ratings_json: "{}",
        user_id: user?.id || null,
        created_at: new Date().toISOString(),
        watched_at: watched ? new Date().toISOString() : null,
      };

      importedEntries.push(newEntry);
      successCount++;

      // Small delay to make progress animation look smooth and readable
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (importedEntries.length > 0) {
      try {
        console.log("CineTrack [Diagnostics]: Bulk saving entries to MongoDB...", importedEntries.length);
        const res = await fetch("/api/movies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(importedEntries)
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to batch save movies to MongoDB");
        }
        console.log("CineTrack [Diagnostics]: MongoDB bulk import succeeded!");

        const updatedMovies = [...importedEntries, ...movies];
        await saveMoviesState(updatedMovies);
        await refetchMovies();
       broadcastMovieChange();

        logActivity(
          "add",
          `${importedEntries.length} imported titles`,
          "Collection",
          `batch imported ${importedEntries.length} titles from custom list`
        );

        showToast(
          `Successfully imported ${successCount} titles!`,
          "success"
        );
      } catch (err: any) {
        console.error("Error updating local state after bulk import:", err);
        showToast(`Failed to save imported movies: ${err.message}`, "warning");
      }
    }

    return successCount;
  };

  // 2. Collaborative Co-Watch Toggle — propagates to ALL copies of the movie across the group
  const handleToggleFriendWatched = async (id: string, friendName: string) => {
    const targetMovie = movies.find((m) => m.id === id);
    if (!targetMovie) return;

    // Only the current user can toggle their own name
    if (friendName !== myName) return;

    const currentWatchedBy = targetMovie.watched_by
      ? targetMovie.watched_by.split(", ").filter(Boolean)
      : [];

    const isMarkingWatched = !currentWatchedBy.includes(myName);

    const existingUserRow = movies.find(
      (m) => m.tmdb_id === targetMovie.tmdb_id && m.user_id === user?.id
    );
    const resolvedCreatedAt = existingUserRow?.created_at || new Date().toISOString();

    try {
      const newEntry = {
        tmdb_id: targetMovie.tmdb_id,
        title: targetMovie.title,
        poster_path: targetMovie.poster_path,
        backdrop_path: targetMovie.backdrop_path,
        release_year: targetMovie.release_year,
        runtime: targetMovie.runtime,
        synopsis: targetMovie.synopsis,
        watched: isMarkingWatched,
        rating: null,
        review: null,
        seasons: targetMovie.seasons,
        episodes: targetMovie.episodes || null,
        category: targetMovie.category,
        global_rating: targetMovie.global_rating,
        genres: targetMovie.genres,
        user_id: user?.id,
        watched_by: "",
        ratings_json: "{}",
        reviews_json: "{}",
        created_at: resolvedCreatedAt,
        watched_at: isMarkingWatched ? new Date().toISOString() : null,
      };

      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) throw new Error("Failed to update watched status in MongoDB");

      await refetchMovies();
      broadcastMovieChange();

      logActivity(
        isMarkingWatched ? "watch" : "unwatch",
        targetMovie.title,
        targetMovie.category,
        isMarkingWatched
          ? "marked it as watched"
          : "moved it back to Unwatched list"
      );

      showToast(
        isMarkingWatched
          ? `Marked "${targetMovie.title}" as watched!`
          : `Marked "${targetMovie.title}" as unwatched.`,
        "success"
      );
    } catch (err) {
      console.error("Failed to update watched status:", err);
      showToast("Error updating status.", "warning");
    }
  };

  // 2b. Collaborative Decline Toggle — hides the movie from the current user's unwatched list
  const handleToggleDeclined = async (id: string, friendName: string) => {
    const targetMovie = movies.find((m) => m.id === id);
    if (!targetMovie) return;

    if (friendName !== myName) return;

    const currentDeclinedBy = targetMovie.declined_by
      ? targetMovie.declined_by.split(", ").filter(Boolean)
      : [];

    const isMarkingDeclined = !currentDeclinedBy.includes(myName);

    const existingUserRow = movies.find(
      (m) => m.tmdb_id === targetMovie.tmdb_id && m.user_id === user?.id
    );
    const resolvedCreatedAt = existingUserRow?.created_at || new Date().toISOString();

    try {
      const newEntry = {
        tmdb_id: targetMovie.tmdb_id,
        title: targetMovie.title,
        poster_path: targetMovie.poster_path,
        backdrop_path: targetMovie.backdrop_path,
        release_year: targetMovie.release_year,
        runtime: targetMovie.runtime,
        synopsis: targetMovie.synopsis,
        watched: targetMovie.watched,
        declined: isMarkingDeclined,
        rating: targetMovie.rating,
        review: targetMovie.review,
        seasons: targetMovie.seasons,
        episodes: targetMovie.episodes || null,
        category: targetMovie.category,
        global_rating: targetMovie.global_rating,
        genres: targetMovie.genres,
        user_id: user?.id,
        watched_by: "",
        ratings_json: "{}",
        reviews_json: "{}",
        created_at: resolvedCreatedAt,
      };

      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) throw new Error("Failed to update declined status in MongoDB");

      await refetchMovies();
      broadcastMovieChange();

      logActivity(
        isMarkingDeclined ? "decline" : "undecline",
        targetMovie.title,
        targetMovie.category,
        isMarkingDeclined
          ? "marked it as Not Interested"
          : "restored it back to Unwatched list"
      );

      showToast(
        isMarkingDeclined
          ? `Moved "${targetMovie.title}" to Declined list!`
          : `Restored "${targetMovie.title}" to Unwatched.`,
        "success"
      );
    } catch (err) {
      console.error("Failed to update declined status:", err);
      showToast("Error updating status.", "warning");
    }
  };

  // 2c. Collaborative Season Completion Toggle
  // 3. Delete Movie operation
  const handleDeleteMovie = async (id: string) => {
    const targetMovie = movies.find((m) => m.id === id);
    if (!targetMovie) return;

    try {
      const res = await fetch(`/api/movies?tmdb_id=${targetMovie.tmdb_id}&user_id=${user?.id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Failed to delete movie from MongoDB");

      const updatedMovies = movies.filter((m) => m.id !== id);
      await saveMoviesState(updatedMovies);
      await refetchMovies();
      broadcastMovieChange();

      // Log Activity
      logActivity("delete", targetMovie.title, targetMovie.category, "removed it from library");

      showToast(`Removed "${targetMovie.title}" from library.`, "info");
    } catch (err) {
      console.error("Failed to delete movie:", err);
      showToast("Error removing movie.", "warning");
    }
  };

  const handleCreateCustomMovie = async (movieData: any) => {
    if (!user) return;
    try {
      const myName = user?.display_name || user?.username || "Me";
      
      const newEntry: Movie = {
        id: `custom-${Date.now()}`,
        tmdb_id: `custom-${Date.now()}`,
        title: movieData.title,
        poster_path: movieData.poster_path,
        backdrop_path: "",
        release_year: movieData.release_year,
        runtime: movieData.runtime,
        synopsis: movieData.synopsis,
        watched: movieData.watched,
        rating: null,
        review: null,
        seasons: movieData.seasons,
        episodes: movieData.episodes || null,
        category: movieData.category,
        global_rating: null,
        genres: movieData.genres,
        watched_by: movieData.watched ? myName : "",
        ratings_json: "{}",
        reviews_json: myName,
        owners: myName,
        user_id: user.id,
        created_at: new Date().toISOString(),
      };

      console.log("CineTrack [Custom Entry]: Saving custom movie to MongoDB...", newEntry);
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) {
        throw new Error("Failed to save custom movie to MongoDB");
      }

      console.log("CineTrack [Custom Entry]: Custom movie saved successfully!");
      const updatedMovies = [newEntry, ...movies];
      await saveMoviesState(updatedMovies);
      await refetchMovies();
      
      // Send real-time broadcast update to friends
      broadcastMovieChange();

      logActivity(
        "add",
        newEntry.title,
        newEntry.category,
        newEntry.watched ? "created custom title in Watched list" : "created custom title in Unwatched list"
      );

      showToast(
        `Successfully added custom entry "${newEntry.title}"!`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to save custom movie:", err);
      showToast("Error creating custom entry.", "warning");
    }
  };

  // 4. Update Co-Watch Rating
  const handleUpdateFriendRating = async (id: string, friendName: string, rating: number) => {
    const targetMovie = movies.find((m) => m.id === id);
    if (!targetMovie) return;

    // Only allow the current user to update their own rating
    if (friendName !== myName) return;

    try {
      const res = await fetch(`/api/movies?tmdb_id=${targetMovie.tmdb_id}&user_id=${user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });

      if (!res.ok) throw new Error("Failed to save rating to MongoDB");

      await refetchMovies();
      broadcastMovieChange();
      logActivity("rate", targetMovie.title, targetMovie.category, `rated it ${rating}/5 stars`);
      showToast(`${friendName}'s rating saved!`, "success");
    } catch (err) {
      console.error("Failed to update rating:", err);
      showToast("Error updating rating.", "warning");
    }
  };

  // 5. Update Co-Watch Review note
  const handleUpdateFriendReview = async (id: string, friendName: string, review: string) => {
    const targetMovie = movies.find((m) => m.id === id);
    if (!targetMovie) return;

    // Only allow the current user to update their own review
    if (friendName !== myName) return;

    try {
      const res = await fetch(`/api/movies?tmdb_id=${targetMovie.tmdb_id}&user_id=${user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review })
      });

      if (!res.ok) throw new Error("Failed to save review to MongoDB");

      await refetchMovies();
      broadcastMovieChange();
      logActivity(
        "review",
        targetMovie.title,
        targetMovie.category,
        `updated thoughts: "${review.length > 25 ? `${review.substring(0, 25)}...` : review}"`
      );
      showToast(`${friendName}'s note saved!`, "success");
    } catch (err) {
      console.error("Failed to update thoughts:", err);
      showToast("Error saving thoughts.", "warning");
    }
  };

  // 6. Reset all libraries
  const handleResetLibrary = async () => {
    if (!window.confirm("Are you sure you want to clear your entire library and activity logs?")) {
      return;
    }

    try {
      const res = await fetch(`/api/movies?user_id=${user?.id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Failed to clear library from MongoDB");

      // Also clear activities in MongoDB
      await fetch(`/api/activities?user_id=${user?.id}`, {
        method: "DELETE"
      });

      await saveMoviesState([]);
      setActivities([]);
      localStorage.removeItem("cinetrack_activities");
      showToast("Cleared your entire tracking library and activities.", "warning");
    } catch (err) {
      console.error("Failed to clear database:", err);
      showToast("Error clearing database.", "warning");
    }
  };

  // === Add to My List handler ===
  const handleAddToMyList = async (movie: Movie) => {
    if (!user) return;
    if (isMovieOwnedByUser(movie, myName)) {
      showToast(`"${movie.title}" is already in your list.`, "info");
      return;
    }
    try {
      const existingRow = movies.find(m => m.tmdb_id === movie.tmdb_id && m.user_id === user.id);
      const newEntry = {
        tmdb_id: movie.tmdb_id,
        title: movie.title,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        release_year: movie.release_year,
        release_date: movie.release_date,
        runtime: movie.runtime,
        synopsis: movie.synopsis,
        watched: false,
        declined: false,
        rating: null,
        review: null,
        seasons: movie.seasons,
        episodes: movie.episodes || null,
        category: movie.category,
        global_rating: movie.global_rating,
        genres: movie.genres,
        watched_by: "",
        declined_by: "",
        ratings_json: "{}",
        reviews_json: myName,
        owners: myName,
        user_id: user.id,
        created_at: existingRow?.created_at || new Date().toISOString(),
        watched_at: null,
      };
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry),
      });
      if (!res.ok) throw new Error("Failed to add to your list");
      await refetchMovies();
      broadcastMovieChange();
      logActivity("add", movie.title, movie.category, "added it to their Unwatched list");
      showToast(`"${movie.title}" added to your list!`, "success");
    } catch (err: any) {
      showToast("Error adding to your list.", "warning");
    }
  };

  // === 3-TIER LIST LOGIC ===
  const baseUnwatchedList = movies.filter((m) => {
    // Filter out future/upcoming movies
    const today = new Date().toISOString().split("T")[0];
    if (m.release_date && m.release_date > today) return false;
    return true;
  });

  const baseUpcomingList = movies.filter((m) => {
    // Only include upcoming titles
    const today = new Date().toISOString().split("T")[0];
    return m.release_date && m.release_date > today;
  });

  // DECLINED: movies that the current user personally declined (not interested / thumbs down)
  const baseDeclinedList = movies.filter((m) => isMovieDeclinedByUser(m, myName));

  // MY WATCHED: movies where the current user personally has watched=true
  const baseMyWatchedList = movies.filter((m) => isMovieWatchedByUser(m, myName));

  // MY UNWATCHED: movies owned by me, not yet watched, not declined, and already released
  const today = new Date().toISOString().split("T")[0];
  const baseMyUnwatchedList = movies.filter((m) =>
    isMovieOwnedByUser(m, myName) &&
    !isMovieWatchedByUser(m, myName) &&
    !isMovieDeclinedByUser(m, myName) &&
    !(m.release_date && m.release_date > today)
  );

  // MY UPCOMING: upcoming movies owned by me, not yet watched, not declined
  const baseMyUpcomingList = baseUpcomingList.filter((m) =>
    isMovieOwnedByUser(m, myName) &&
    !isMovieWatchedByUser(m, myName) &&
    !isMovieDeclinedByUser(m, myName)
  );

  // COMMON WATCHED: movies where ALL members in the co-watch group have watched
  const baseCommonWatchedList = movies.filter((m) => m.watched);

  // baseWatchedList: watched list by selected view mode user (either my-list or a specific friend)
  const baseWatchedList = movies.filter((m) => {
    const activeUser = watchedViewMode === "my-list" ? myName : watchedViewMode;
    return isMovieWatchedByUser(m, activeUser);
  });

  // Dynamically extract all unique genres from logged items
  const unwatchedGenres = Array.from(
    new Set(
      baseUnwatchedList.flatMap((m) => m.genres ? m.genres.split(", ") : [])
    )
  ).sort();

  const watchedGenres = Array.from(
    new Set(
      baseWatchedList.flatMap((m) => m.genres ? m.genres.split(", ") : [])
    )
  ).sort();

  const upcomingGenres = Array.from(
    new Set(
      baseUpcomingList.flatMap((m) => m.genres ? m.genres.split(", ") : [])
    )
  ).sort();

  // Date filtering helper
  const filterByDateRange = (itemDateStr: string | undefined | null, preset: string, start: string, end: string) => {
    if (preset === "all") return true;
    if (!itemDateStr) return false;

    // Use split("T")[0] to get only the date portion for pure daily comparison
    const itemDateVal = itemDateStr.split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    if (preset === "today") {
      return itemDateVal === today;
    }
    if (preset === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
      return itemDateVal >= sevenDaysAgoStr && itemDateVal <= today;
    }
    if (preset === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
      return itemDateVal >= thirtyDaysAgoStr && itemDateVal <= today;
    }
    if (preset === "custom") {
      if (start && itemDateVal < start) return false;
      if (end && itemDateVal > end) return false;
      return true;
    }
    return true;
  };

  // Filter lists based on type, genres, formats and local searches
  const unwatchedList = baseUnwatchedList
    .filter((m) => {
      const activeUser = unwatchedViewMode === "my-list" ? myName : unwatchedViewMode;
      return isMovieOwnedByUser(m, activeUser) && !isMovieWatchedByUser(m, activeUser) && !isMovieDeclinedByUser(m, activeUser);
    })
    .filter((m) => m.title.toLowerCase().includes(unwatchedFilter.trim().toLowerCase()))
    .filter((m) => {
      if (!unwatchedGenreFilter) return true;
      return m.genres && m.genres.split(", ").includes(unwatchedGenreFilter);
    })
    .filter((m) => {
      if (!unwatchedCategoryFilter) return true;
      return m.category === unwatchedCategoryFilter;
    })
    .filter((m) => filterByDateRange(m.created_at, unwatchedDatePreset, unwatchedStartDate, unwatchedEndDate));

  const watchedList = baseWatchedList
    .filter((m) => m.title.toLowerCase().includes(watchedFilter.trim().toLowerCase()))
    .filter((m) => {
      if (!watchedGenreFilter) return true;
      return m.genres && m.genres.split(", ").includes(watchedGenreFilter);
    })
    .filter((m) => {
      if (!watchedCategoryFilter) return true;
      return m.category === watchedCategoryFilter;
    })
    .filter((m) => filterByDateRange(m.watched_at || m.created_at, watchedDatePreset, watchedStartDate, watchedEndDate));

  const upcomingList = baseUpcomingList
    .filter((m) => {
      const activeUser = upcomingViewMode === "my-list" ? myName : upcomingViewMode;
      return isMovieOwnedByUser(m, activeUser) && !isMovieWatchedByUser(m, activeUser) && !isMovieDeclinedByUser(m, activeUser);
    })
    .filter((m) => m.title.toLowerCase().includes(upcomingFilter.trim().toLowerCase()))
    .filter((m) => {
      if (!upcomingGenreFilter) return true;
      return m.genres && m.genres.split(", ").includes(upcomingGenreFilter);
    })
    .filter((m) => {
      if (!upcomingCategoryFilter) return true;
      return m.category === upcomingCategoryFilter;
    })
    .filter((m) => filterByDateRange(m.created_at, upcomingDatePreset, upcomingStartDate, upcomingEndDate))
    .sort((a, b) => {
      const dateA = a.release_date || "";
      const dateB = b.release_date || "";
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    });

  const declinedList = baseDeclinedList
    .filter((m) => m.title.toLowerCase().includes(declinedFilter.trim().toLowerCase()));

  const totalWatchedRuntime = baseMyWatchedList.reduce((acc, curr) => acc + (curr.runtime || 0), 0);

  return (
    <div className="w-full bg-zinc-950 min-h-screen text-zinc-100 flex flex-col antialiased pb-20 md:pb-0">
      {/* Decorative Glow Bubbles */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-96 h-96 bg-emerald-500/3 rounded-full filter blur-[100px] pointer-events-none" />

      {/* ── Sleek Top Bar ── */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md select-none">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <div
            onClick={() => { setActiveTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-all">
              <Film className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent hidden sm:block">
              CineTrack
            </h1>
          </div>

          {/* Desktop Nav — icon + label pills */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {[
              { tab: "dashboard",          icon: <LayoutDashboard className="w-3.5 h-3.5" />, label: "Home",     accent: "indigo", badge: null },
              { tab: "unwatched",          icon: <Compass        className="w-3.5 h-3.5" />, label: "Unwatched", accent: "amber",  badge: baseMyUnwatchedList.length > 0 ? baseMyUnwatchedList.length : null },
              { tab: "watched",            icon: <Trophy         className="w-3.5 h-3.5" />, label: "Watched",  accent: "emerald", badge: baseMyWatchedList.length > 0 ? baseMyWatchedList.length : null },
              { tab: "upcoming_watchlist", icon: <Calendar       className="w-3.5 h-3.5" />, label: "Upcoming", accent: "amber",   badge: baseMyUpcomingList.length > 0 ? baseMyUpcomingList.length : null },
              { tab: "declined",           icon: <ThumbsDown     className="w-3.5 h-3.5" />, label: "Declined", accent: "red",     badge: baseDeclinedList.length > 0 ? baseDeclinedList.length : null },
            ].map(({ tab, icon, label, accent, badge }) => {
              const isActive = activeTab === tab;
              const accentMap: Record<string, string> = {
                indigo:  isActive ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"  : "hover:text-indigo-300",
                amber:   isActive ? "bg-amber-500/10  text-amber-400  border-amber-500/25"   : "hover:text-amber-300",
                emerald: isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "hover:text-emerald-300",
                red:     isActive ? "bg-red-500/10    text-red-400    border-red-500/25"     : "hover:text-red-300",
              };
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab as any); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isActive
                      ? `${accentMap[accent]}`
                      : `text-zinc-500 border-transparent hover:bg-zinc-900/60 ${accentMap[accent]}`
                  }`}
                  title={label}
                >
                  {icon}
                  <span>{label}</span>
                  {badge != null && (
                    <span className={`ml-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-red-500/20 text-red-400" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}>{badge}</span>
                  )}
                </button>
              );
            })}

            {/* Admin — only if privileged */}
            {(user?.role === "superadmin" || user?.role === "admin") && (
              <button
                onClick={() => { setActiveTab("admin"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeTab === "admin"
                    ? "bg-violet-500/10 text-violet-400 border-violet-500/25"
                    : "text-zinc-500 border-transparent hover:bg-zinc-900/60 hover:text-violet-300"
                }`}
                title="Admin Panel"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right side: Friends + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Friends button */}
            <button
              onClick={() => setShowFriendsPanel(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-indigo-500/30 text-zinc-400 hover:text-indigo-300 transition-all cursor-pointer"
              title="Friends"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-bold hidden sm:inline">Friends</span>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
              {authFriends.length > 0 && pendingRequests.length === 0 && (
                <span className="text-[9px] text-zinc-500 font-bold">({authFriends.length})</span>
              )}
            </button>

            {/* Avatar + sign-out */}
            {user && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0 shadow-inner"
                  style={{ backgroundColor: user.avatar_color || "#6366f1" }}
                >
                  {(user.display_name || user.username || "Me").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-extrabold text-zinc-100 whitespace-nowrap">
                    {user.display_name}
                  </span>
                  <span className="text-[8px] font-bold text-indigo-400 whitespace-nowrap">
                    @{user.username}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer ml-0.5"
                  title="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>



      {/* Friends Panel Slide-Over */}
      {showFriendsPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFriendsPanel(false)}
          />
          <div className="relative ml-auto w-full max-w-sm bg-zinc-950 border-l border-zinc-800 flex flex-col h-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Co-Watch Friends
              </h2>
              <button
                onClick={() => setShowFriendsPanel(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FriendsPanel />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <BulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onImport={handleBulkImportConfirm}
          isTracked={isTracked}
          onSearchFailedTitle={handleSearchSubmit}
        />
      )}

      {/* Custom Movie Creator Modal */}
      <CustomMovieModal
        isOpen={isCustomMovieModalOpen}
        onClose={() => setIsCustomMovieModalOpen(false)}
        onSave={handleCreateCustomMovie}
      />


      {/* Centered Main Work Workspace Area */}
      <main className="flex-grow p-4 md:p-8 max-w-6xl w-full mx-auto flex flex-col gap-6 overflow-x-hidden">
        
        {/* Sleek Global TMDB Search Bar */}
        <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 relative">
          <div className="w-full sm:flex-1">
            <SearchBar 
              onAddMovie={handleAddMovie} 
              isTracked={isTracked} 
              onSearchSubmit={(q) => handleSearchSubmit(q, 1)}
            />
          </div>
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            title="Bulk Import from Google Sheets/CSV"
          >
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Bulk Import</span>
          </button>
        </div>

        {/* VIEW 1: HOME DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6 animate-fade-in">


            {/* Quick Metrics */}
            {loading ? (
              <div className="py-8 flex flex-col items-center text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs font-semibold mt-2">Loading dashboard...</span>
              </div>
            ) : (
              <StatsPanel
                totalMovies={movies.length}
                unwatchedCount={baseMyUnwatchedList.length}
                myWatchedCount={baseMyWatchedList.length}
                coWatchedCount={baseCommonWatchedList.length}
                totalRuntime={totalWatchedRuntime}
              />
            )}

            {/* Curated Showcase Sections */}
            {sectionsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading dashboard showcases...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {renderShowcaseRow("Trending Today", trendingTodaySection, "🔥")}
                {renderShowcaseRow("Trending This Week", trendingWeekSection, "📈")}
                {renderShowcaseRow("Next Week Releases", nextWeekSection, "📅", true)}
              </div>
            )}




          </div>
        )}

        {/* VIEW 2: UNWATCHED LIST */}
        {activeTab === "unwatched" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Queue Header Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  🍿 Unwatched Queue
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Curated logs of titles to enjoy in the future.</p>
              </div>

              {/* Local Search within Unwatched list */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={unwatchedFilter}
                  onChange={(e) => setUnwatchedFilter(e.target.value)}
                  placeholder="Search unwatched queue..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 focus:border-amber-500 rounded-xl text-zinc-200 text-xs font-semibold focus:outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* View List Selector for Unwatched */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
              <span className="text-[8.5px] font-extrabold text-zinc-550 uppercase tracking-widest mr-1.5 flex items-center gap-1 flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-amber-400" /> View List:
              </span>

              {(friends.length > 0 ? friends : [myName]).map((friend) => {
                const isActive = unwatchedViewMode === "my-list" ? (friend === myName) : (unwatchedViewMode === friend);
                return (
                  <button
                    key={friend}
                    onClick={() => setUnwatchedViewMode(friend === myName ? "my-list" : friend)}
                    className={`px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 duration-200 flex-shrink-0 ${
                      isActive
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    👤 {friend === myName ? "My List" : `${friend}'s List`} {isActive ? `(${unwatchedList.length})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Premium modern clickable capsule pill chips */}
            <div className="flex flex-col gap-3.5 py-2.5 border-b border-zinc-900 pb-5 select-none">
              {/* Format pills */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Format:</span>
                {[
                  { label: "All Formats", value: "" },
                  { label: "Movies", value: "Movie" },
                  { label: "Series / Seasons", value: "TV Show" },
                  { label: "Animated", value: "Animated Movie" },
                  { label: "Anime", value: "Anime" }
                ].map((format) => {
                  const isActiveFormat = unwatchedCategoryFilter === format.value;
                  return (
                    <button
                      key={format.label}
                      onClick={() => setUnwatchedCategoryFilter(format.value)}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActiveFormat
                          ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {format.label}{isActiveFormat ? ` (${unwatchedList.length})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Genre pills */}
              {unwatchedGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-extrabold text-zinc-550 uppercase tracking-widest mr-2 select-none">Genre:</span>
                  <button
                    onClick={() => setUnwatchedGenreFilter("")}
                    className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                      unwatchedGenreFilter === ""
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                        : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    All Genres {unwatchedGenreFilter === "" ? `(${unwatchedList.length})` : ""}
                  </button>
                  {unwatchedGenres.map((genre) => {
                    const isActive = unwatchedGenreFilter === genre;
                    return (
                      <button
                        key={genre}
                        onClick={() => setUnwatchedGenreFilter(genre)}
                        className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                          isActive
                            ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                            : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {genre}{isActive ? ` (${unwatchedList.length})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Date Added filter */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-550 uppercase tracking-widest mr-2 select-none">Date Added:</span>
                {[
                  { label: "All Time", value: "all" },
                  { label: "Today", value: "today" },
                  { label: "Last 7 Days", value: "7days" },
                  { label: "Last 30 Days", value: "30days" },
                  { label: "Custom Range", value: "custom" }
                ].map((preset) => {
                  const isActive = unwatchedDatePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setUnwatchedDatePreset(preset.value);
                        if (preset.value !== "custom") {
                          setUnwatchedStartDate("");
                          setUnwatchedEndDate("");
                        }
                      }}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActive
                          ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                {unwatchedDatePreset === "custom" && (
                  <div className="flex items-center gap-1.5 ml-2 animate-fade-in">
                    <input
                      type="date"
                      value={unwatchedStartDate}
                      onChange={(e) => setUnwatchedStartDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[9px] text-zinc-500 font-bold uppercase">to</span>
                    <input
                      type="date"
                      value={unwatchedEndDate}
                      onChange={(e) => setUnwatchedEndDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-32 flex flex-col justify-center items-center text-zinc-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                <span className="text-xs font-semibold">Syncing queue...</span>
              </div>
            ) : unwatchedList.length === 0 ? (
              <div className="py-24 text-center select-none">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mx-auto text-zinc-500 text-xl border border-zinc-850 mb-3">
                  🎬
                </div>
                <h4 className="text-sm font-bold text-zinc-400">
                  {unwatchedViewMode === "my-list" ? "Your queue is empty" : `${unwatchedViewMode}'s queue is empty`}
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {unwatchedFilter
                    ? `No unwatched items match "${unwatchedFilter}". Try searching something else.`
                    : unwatchedViewMode === "my-list"
                      ? "Your queue is completely empty. Search above or use the trending section on Home to add titles."
                      : `${unwatchedViewMode} hasn't added any unwatched titles yet. Browse their list and add any you want to yours!`}
                </p>
              </div>
            ) : (
              /* High-end Multi-column Grid Layout (up to 6 columns on xl) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {unwatchedList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onToggleDeclined={handleToggleDeclined}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
                    onCardClick={() => openDetailModal(movie.tmdb_id, movie.category)}
                    isInMyList={movies.some((m) => m.tmdb_id === movie.tmdb_id && isMovieOwnedByUser(m, myName))}
                    onAddToMyList={unwatchedViewMode !== "my-list" ? () => handleAddToMyList(movie) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "upcoming_watchlist" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Queue Header Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  📅 Upcoming Watchlist
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Track and sync future release dates logged by you or your friends.</p>
              </div>

              {/* Local Search within Upcoming list */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={upcomingFilter}
                  onChange={(e) => setUpcomingFilter(e.target.value)}
                  placeholder="Search upcoming queue..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 focus:border-amber-500 rounded-xl text-zinc-200 text-xs font-semibold focus:outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* View List Selector for Upcoming */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
              <span className="text-[8.5px] font-extrabold text-zinc-550 uppercase tracking-widest mr-1.5 flex items-center gap-1 flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-amber-400" /> View List:
              </span>

              {(friends.length > 0 ? friends : [myName]).map((friend) => {
                const isActive = upcomingViewMode === "my-list" ? (friend === myName) : (upcomingViewMode === friend);
                return (
                  <button
                    key={friend}
                    onClick={() => setUpcomingViewMode(friend === myName ? "my-list" : friend)}
                    className={`px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 duration-200 flex-shrink-0 ${
                      isActive
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    👤 {friend === myName ? "My List" : `${friend}'s List`} {isActive ? `(${upcomingList.length})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Premium modern clickable capsule pill chips */}
            <div className="flex flex-col gap-3.5 py-2.5 border-b border-zinc-900 pb-5 select-none">
              {/* Format pills */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Format:</span>
                {[
                  { label: "All Formats", value: "" },
                  { label: "Movies", value: "Movie" },
                  { label: "Series / Seasons", value: "TV Show" },
                  { label: "Animated", value: "Animated Movie" },
                  { label: "Anime", value: "Anime" }
                ].map((format) => {
                  const isActiveFormat = upcomingCategoryFilter === format.value;
                  return (
                    <button
                      key={format.label}
                      onClick={() => setUpcomingCategoryFilter(format.value)}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActiveFormat
                          ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {format.label}{isActiveFormat ? ` (${upcomingList.length})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Genre pills */}
              {upcomingGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-extrabold text-zinc-550 uppercase tracking-widest mr-2 select-none">Genre:</span>
                  <button
                    onClick={() => setUpcomingGenreFilter("")}
                    className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                      upcomingGenreFilter === ""
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                        : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    All Genres {upcomingGenreFilter === "" ? `(${upcomingList.length})` : ""}
                  </button>
                  {upcomingGenres.map((genre) => {
                    const isActive = upcomingGenreFilter === genre;
                    return (
                      <button
                        key={genre}
                        onClick={() => setUpcomingGenreFilter(genre)}
                        className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                          isActive
                            ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                            : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {genre}{isActive ? ` (${upcomingList.length})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Date Added filter */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-550 uppercase tracking-widest mr-2 select-none">Date Added:</span>
                {[
                  { label: "All Time", value: "all" },
                  { label: "Today", value: "today" },
                  { label: "Last 7 Days", value: "7days" },
                  { label: "Last 30 Days", value: "30days" },
                  { label: "Custom Range", value: "custom" }
                ].map((preset) => {
                  const isActive = upcomingDatePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setUpcomingDatePreset(preset.value);
                        if (preset.value !== "custom") {
                          setUpcomingStartDate("");
                          setUpcomingEndDate("");
                        }
                      }}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActive
                          ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                {upcomingDatePreset === "custom" && (
                  <div className="flex items-center gap-1.5 ml-2 animate-fade-in">
                    <input
                      type="date"
                      value={upcomingStartDate}
                      onChange={(e) => setUpcomingStartDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[9px] text-zinc-500 font-bold uppercase">to</span>
                    <input
                      type="date"
                      value={upcomingEndDate}
                      onChange={(e) => setUpcomingEndDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-32 flex flex-col justify-center items-center text-zinc-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                <span className="text-xs font-semibold">Syncing queue...</span>
              </div>
            ) : upcomingList.length === 0 ? (
              <div className="py-24 text-center select-none">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mx-auto text-zinc-500 text-xl border border-zinc-850 mb-3">
                  📅
                </div>
                <h4 className="text-sm font-bold text-zinc-400">No items found in your upcoming list</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {upcomingFilter 
                    ? `No logged upcoming items match "${upcomingFilter}". Try searching something else.`
                    : "No future releases are currently tracked by you or your friends. Search and add movies that are yet to premiere."}
                </p>
              </div>
            ) : (
              /* High-end Multi-column Grid Layout (up to 6 columns on xl) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {upcomingList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onToggleDeclined={handleToggleDeclined}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
                    onCardClick={() => openDetailModal(movie.tmdb_id, movie.category)}
                    isInMyList={movies.some((m) => m.tmdb_id === movie.tmdb_id && isMovieOwnedByUser(m, myName))}
                    onAddToMyList={upcomingViewMode !== "my-list" ? () => handleAddToMyList(movie) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: WATCHED COLLECTION */}
        {activeTab === "watched" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Library Header Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  🏆 Watched Collection
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Trophy shelf containing your rated films and series thoughts.</p>
              </div>

              {/* Local Search within Watched list */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={watchedFilter}
                  onChange={(e) => setWatchedFilter(e.target.value)}
                  placeholder="Search watched shelf..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 focus:border-emerald-500 rounded-xl text-zinc-200 text-xs font-semibold focus:outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* View List Selector for Watched */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
              <span className="text-[8.5px] font-extrabold text-zinc-550 uppercase tracking-widest mr-1.5 flex items-center gap-1 flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> View List:
              </span>

              {(friends.length > 0 ? friends : [myName]).map((friend) => {
                const isActive = watchedViewMode === "my-list" ? (friend === myName) : (watchedViewMode === friend);
                return (
                  <button
                    key={friend}
                    onClick={() => setWatchedViewMode(friend === myName ? "my-list" : friend)}
                    className={`px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 duration-200 flex-shrink-0 ${
                      isActive
                        ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    👤 {friend === myName ? "My List" : `${friend}'s List`} {isActive ? `(${watchedList.length})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Premium modern clickable capsule pill chips */}
            <div className="flex flex-col gap-3.5 py-2.5 border-b border-zinc-900 pb-5 select-none">
              {/* Format pills */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Format:</span>
                {[
                  { label: "All Formats", value: "" },
                  { label: "Movies", value: "Movie" },
                  { label: "Series / Seasons", value: "TV Show" },
                  { label: "Animated", value: "Animated Movie" },
                  { label: "Anime", value: "Anime" }
                ].map((format) => {
                  const isActiveFormat = watchedCategoryFilter === format.value;
                  return (
                    <button
                      key={format.label}
                      onClick={() => setWatchedCategoryFilter(format.value)}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActiveFormat
                          ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {format.label}{isActiveFormat ? ` (${watchedList.length})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Genre pills */}
              {watchedGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Genre:</span>
                  <button
                    onClick={() => setWatchedGenreFilter("")}
                    className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                      watchedGenreFilter === ""
                        ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                        : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    All Genres {watchedGenreFilter === "" ? `(${watchedList.length})` : ""}
                  </button>
                  {watchedGenres.map((genre) => {
                    const isActive = watchedGenreFilter === genre;
                    return (
                      <button
                        key={genre}
                        onClick={() => setWatchedGenreFilter(genre)}
                        className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                          isActive
                            ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                            : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {genre}{isActive ? ` (${watchedList.length})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Date Watched filter */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Date Watched:</span>
                {[
                  { label: "All Time", value: "all" },
                  { label: "Today", value: "today" },
                  { label: "Last 7 Days", value: "7days" },
                  { label: "Last 30 Days", value: "30days" },
                  { label: "Custom Range", value: "custom" }
                ].map((preset) => {
                  const isActive = watchedDatePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setWatchedDatePreset(preset.value);
                        if (preset.value !== "custom") {
                          setWatchedStartDate("");
                          setWatchedEndDate("");
                        }
                      }}
                      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                        isActive
                          ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                          : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                {watchedDatePreset === "custom" && (
                  <div className="flex items-center gap-1.5 ml-2 animate-fade-in">
                    <input
                      type="date"
                      value={watchedStartDate}
                      onChange={(e) => setWatchedStartDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[9px] text-zinc-500 font-bold uppercase">to</span>
                    <input
                      type="date"
                      value={watchedEndDate}
                      onChange={(e) => setWatchedEndDate(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-32 flex flex-col justify-center items-center text-zinc-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                <span className="text-xs font-semibold">Syncing collection...</span>
              </div>
            ) : watchedList.length === 0 ? (
              <div className="py-24 text-center select-none animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mx-auto text-zinc-500 text-xl border border-zinc-850 mb-3">
                  🎖️
                </div>
                <h4 className="text-sm font-bold text-zinc-400">No watched media found</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {watchedFilter
                    ? `No logged watched items match "${watchedFilter}" on this shelf.`
                    : "Nobody has marked titles watched on this shelf yet. Switch or complete titles in Unwatched!"}
                </p>
              </div>
            ) : (
              /* High-end Multi-column Grid Layout (up to 6 columns on xl) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {watchedList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onToggleDeclined={handleToggleDeclined}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
                    onCardClick={() => openDetailModal(movie.tmdb_id, movie.category)}
                    isInMyList={movies.some((m) => m.tmdb_id === movie.tmdb_id && isMovieOwnedByUser(m, myName))}
                    onAddToMyList={watchedViewMode !== "my-list" ? () => handleAddToMyList(movie) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3.5: DECLINED / NOT INTERESTED LIST */}
        {activeTab === "declined" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Library Header Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  👎 Not Interested
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Movies and TV shows you have personally declined from your main queue.</p>
              </div>

              {/* Local Search within Declined list */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={declinedFilter}
                  onChange={(e) => setDeclinedFilter(e.target.value)}
                  placeholder="Search not interested..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 focus:border-red-500 rounded-xl text-zinc-200 text-xs font-semibold focus:outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-32 flex flex-col justify-center items-center text-zinc-550 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                <span className="text-xs font-semibold">Syncing list...</span>
              </div>
            ) : declinedList.length === 0 ? (
              <div className="py-24 text-center select-none animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mx-auto text-zinc-500 text-xl border border-zinc-850 mb-3">
                  🗑️
                </div>
                <h4 className="text-sm font-bold text-zinc-400">No declined items found</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {declinedFilter
                    ? `No declined items match "${declinedFilter}".`
                    : "You haven't marked any movie/series as 'Not Interested' yet!"}
                </p>
              </div>
            ) : (
              /* High-end Multi-column Grid Layout (up to 6 columns on xl) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {declinedList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onToggleDeclined={handleToggleDeclined}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
                    onCardClick={() => openDetailModal(movie.tmdb_id, movie.category)}
                    isInMyList={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: DEDICATED FULL SEARCH RESULTS */}
        {activeTab === "search_results" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Search Tab Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 select-none">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                  🔍 Search Results for &ldquo;{searchTabQuery}&rdquo;
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Showing matching global database items from TMDB.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomMovieModalOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  ✨ Create Custom Entry
                </button>
                <button
                  onClick={() => {
                    setActiveTab("dashboard");
                    setSearchTabQuery("");
                    setSearchTabResults([]);
                  }}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-205 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto"
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>

            {/* Results Grid Container */}
            {searchTabLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-zinc-500">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-xs font-bold mt-2.5">Fetching matching titles...</span>
              </div>
            ) : searchTabResults.length === 0 ? (
              <div className="py-24 text-center select-none bg-zinc-900/10 border border-dashed border-zinc-900 rounded-3xl p-8 max-w-lg mx-auto">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500 text-lg mb-3">
                  🍿
                </div>
                <h3 className="text-sm font-bold text-zinc-350">No matching movies or shows found</h3>
                <p className="text-[10px] text-zinc-650 mt-1">We couldn&rsquo;t find anything matching &ldquo;{searchTabQuery}&rdquo;.</p>
                <button
                  onClick={() => setIsCustomMovieModalOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md select-none border border-indigo-500/30"
                >
                  ✨ Create Custom Entry
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchTabResults.map((movie) => {
                    const year = movie.release_date ? movie.release_date.split("-")[0] : "N/A";
                    const formatReleaseDate = (dateStr?: string | null) => {
                      if (!dateStr) return null;
                      const parts = dateStr.split("-");
                      if (parts.length !== 3) return dateStr;
                      const [y, m, d] = parts;
                      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                      const mIdx = parseInt(m, 10) - 1;
                      if (mIdx < 0 || mIdx > 11) return dateStr;
                      return `${months[mIdx]} ${parseInt(d, 10)}, ${y}`;
                    };
                    const displayDate = formatReleaseDate(movie.release_date) || year;
                    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
                    const posterUrl = movie.poster_path
                      ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
                      : "";
                    const movieTracked = isTracked(movie.id.toString());

                    return (
                      <article key={movie.id} className="flex flex-col gap-3 p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl hover:border-zinc-750 hover:bg-zinc-900/90 transition-all duration-300 shadow-sm group">
                        {/* First Row: Poster + Info */}
                        <div className="flex gap-3 xs:gap-4 items-start">
                          {/* Poster Thumbnail */}
                          <div 
                            onClick={() => openDetailModal(movie.id.toString(), movie.category || "Movie")}
                            className="w-[84px] h-[120px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-850 shadow-sm flex-shrink-0 relative select-none flex items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:brightness-110 active:scale-95 transition-all"
                            title="Click to view details, episodes & trailer"
                          >
                            {posterUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={posterUrl}
                                  alt={movie.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                  loading="lazy"
                                />
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col justify-center items-center text-center p-2 text-zinc-650 bg-zinc-950 select-none">
                                <Film className="w-5 h-5 mb-1 opacity-30" />
                                <span className="text-[7.5px] font-bold uppercase tracking-wider">No Poster</span>
                              </div>
                            )}
                          </div>

                          {/* Metadata Details */}
                          <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                              <h3 
                                onClick={() => openDetailModal(movie.id.toString(), movie.category || "Movie")}
                                className="text-sm font-black text-zinc-100 line-clamp-2 leading-tight cursor-pointer hover:text-indigo-400 transition-colors"
                                title="Click to view details, episodes & trailer"
                              >
                                {movie.title}
                              </h3>

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
                                <span>{displayDate}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                                <span className="text-amber-500 font-semibold">⭐ {rating}</span>
                              </div>

                              {/* Live Metadata Badges for TV Shows / Anime */}
                              {(movie.category === "TV Show" || movie.category === "Anime") && movie.seasons && (
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[8.5px] font-extrabold select-none">
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-indigo-400">
                                    ⏱️ {movie.runtime ? `${Math.round(movie.runtime / 60)}h` : "N/A"}
                                  </span>
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-zinc-350">
                                    📺 {movie.episodes || 0} eps
                                  </span>
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-zinc-350">
                                    📂 {movie.seasons || 0} {movie.seasons === 1 ? "season" : "seasons"}
                                  </span>
                                </div>
                              )}

                              {/* Live Metadata Badge for Movies */}
                              {(movie.category === "Movie" || movie.category === "Animated Movie") && movie.runtime && (
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[8.5px] font-extrabold select-none">
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-indigo-400">
                                    ⏱️ {movie.runtime ? `${Math.round(movie.runtime / 60)}h ${movie.runtime % 60}m` : "N/A"}
                                  </span>
                                </div>
                              )}

                              {movie.overview && (
                                <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed select-text">
                                  {movie.overview}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Second Row: Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 select-none w-full">
                          {movieTracked ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-950 text-zinc-555 text-[10px] font-bold rounded-xl border border-zinc-850/80 shadow-inner select-none w-full justify-center">
                              <Trophy className="w-3.5 h-3.5 text-emerald-500" /> Tracked
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await handleAddMovie(movie, false);
                                    showToast(`Added ${movie.title} to Queue!`, "success");
                                  } catch (e) {
                                    console.error("Search add failed", e);
                                  }
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-200 text-[10px] font-bold rounded-xl border border-zinc-800 shadow-sm active:scale-95 transition-all cursor-pointer"
                              >
                                🍿 + Queue
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await handleAddMovie(movie, true);
                                    showToast(`Added ${movie.title} to Watched!`, "success");
                                  } catch (e) {
                                    console.error("Search add failed", e);
                                  }
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-xl border border-indigo-500/20 shadow-sm active:scale-95 transition-all cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> Watched
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Pagination footer */}
                <div className="flex items-center justify-center gap-3 border-t border-zinc-900 pt-6 mt-4 select-none">
                  <button
                    disabled={searchTabPage === 1 || searchTabLoading}
                    onClick={() => handleSearchSubmit(searchTabQuery, searchTabPage - 1)}
                    className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-250 text-[10px] font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    ◀ Prev
                  </button>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950 border border-zinc-900 px-3 py-1.5 rounded-xl">
                    Page <strong className="text-zinc-300">{searchTabPage}</strong> of <strong className="text-zinc-300">{searchTabTotalPages}</strong>
                  </span>
                  <button
                    disabled={searchTabPage === searchTabTotalPages || searchTabLoading}
                    onClick={() => handleSearchSubmit(searchTabQuery, searchTabPage + 1)}
                    className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-250 text-[10px] font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: ADMIN PANEL */}
        {activeTab === "admin" && (user?.role === "superadmin" || user?.role === "admin") && (
          <AdminPanel />
        )}

      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-900 px-4 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => {
            setActiveTab("dashboard");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            activeTab === "dashboard" ? "text-indigo-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("unwatched");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            activeTab === "unwatched" ? "text-amber-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[9px] font-bold">Unwatched</span>
          {baseMyUnwatchedList.length > 0 && (
            <span className="absolute top-0 right-1 bg-amber-500 text-zinc-950 text-[8px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm">
              {baseMyUnwatchedList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("watched");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            activeTab === "watched" ? "text-emerald-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[9px] font-bold">Watched</span>
          {baseMyWatchedList.length > 0 && (
            <span className="absolute top-0 right-1 bg-emerald-500 text-white text-[8px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm">
              {baseMyWatchedList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("upcoming_watchlist");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            activeTab === "upcoming_watchlist" ? "text-amber-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[9px] font-bold">Upcoming</span>
          {baseMyUpcomingList.length > 0 && (
            <span className="absolute top-0 right-1 bg-amber-500 text-zinc-950 text-[8px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm">
              {baseMyUpcomingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("declined");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            activeTab === "declined" ? "text-red-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <ThumbsDown className="w-5 h-5" />
          <span className="text-[9px] font-bold">Declined</span>
          {baseDeclinedList.length > 0 && (
            <span className="absolute top-0 right-1 bg-red-500 text-white text-[8px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm">
              {baseDeclinedList.length}
            </span>
          )}
        </button>

        {searchTabQuery && (
          <button
            onClick={() => {
              setActiveTab("search_results");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
              activeTab === "search_results" ? "text-indigo-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
            }`}
          >
            <Search className="w-5 h-5 text-indigo-400" />
            <span className="text-[9px] font-bold">Search</span>
          </button>
        )}

        {(user?.role === "superadmin" || user?.role === "admin") && (
          <button
            onClick={() => {
              setActiveTab("admin");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
              activeTab === "admin" ? "text-violet-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
            }`}
          >
            <Shield className="w-5 h-5 text-violet-400" />
            <span className="text-[9px] font-bold">Admin</span>
          </button>
        )}

        <button
          onClick={() => setShowFriendsPanel(true)}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all relative py-1 px-3 ${
            showFriendsPanel ? "text-indigo-400 scale-105" : "text-zinc-500 hover:text-zinc-350"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold">Friends</span>
          {pendingRequests.length > 0 && (
            <span className="absolute top-0 right-1 bg-indigo-500 text-white text-[8px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm animate-pulse">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Floating Dynamic Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce max-w-xs select-none">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : toast.type === "warning"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Detail Modal Popup */}
      <DetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        tmdbId={detailModalTmdbId}
        category={detailModalCategory}
      />
    </div>
  );
}

// Auth-aware wrapper — exported as the route default
export default function Page() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 select-none">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Film className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          <p className="text-xs text-zinc-500 font-semibold">Loading CineTrack...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <DashboardInner />;
}

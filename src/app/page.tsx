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
  X
} from "lucide-react";
import { Movie, TMDBMovie } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import StatsPanel from "@/components/StatsPanel";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import AuthPage from "@/components/AuthPage";
import FriendsPanel from "@/components/FriendsPanel";
import { useAuth } from "@/lib/AuthContext";
import BulkImportModal from "@/components/BulkImportModal";
import CustomMovieModal from "@/components/CustomMovieModal";

interface ActivityLog {
  id: string;
  type: "add" | "watch" | "unwatch" | "delete" | "rate" | "review";
  title: string;
  category: string;
  timestamp: string;
  details: string;
}

// Inner dashboard — only rendered when user is authenticated
function DashboardInner() {
  const {
    user,
    profile,
    friends: authFriends,
    friendships,
    pendingRequests,
    signOut,
    loading: authLoading,
    requestMergeLists,
    acceptMergeLists,
    rejectMergeLists,
  } = useAuth();
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "unwatched" | "watched" | "search_results">("dashboard");
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);
  const [isCustomMovieModalOpen, setIsCustomMovieModalOpen] = useState(false);
  
  // Dedicated Search Tab States
  const [searchTabQuery, setSearchTabQuery] = useState("");
  const [searchTabResults, setSearchTabResults] = useState<TMDBMovie[]>([]);
  const [searchTabLoading, setSearchTabLoading] = useState(false);
  const [searchTabPage, setSearchTabPage] = useState(1);
  const [searchTabTotalPages, setSearchTabTotalPages] = useState(5);

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
  const [unwatchedGenreFilter, setUnwatchedGenreFilter] = useState("");
  const [watchedGenreFilter, setWatchedGenreFilter] = useState("");
  const [unwatchedCategoryFilter, setUnwatchedCategoryFilter] = useState("");
  const [watchedCategoryFilter, setWatchedCategoryFilter] = useState("");

  // Recent Activity Feed
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const syncChannelRef = useRef<any>(null);

  // Real-time synchronization via Supabase Broadcasts
  useEffect(() => {
    if (!supabase || !user) return;

    console.log("CineTrack Realtime: Subscribing to global sync channel...");
    const channel = supabase.channel("cinetrack_global_sync");
    
    channel
      .on("broadcast", { event: "movie_changed" }, (payload) => {
        const senderId = payload.payload?.senderId;
        const senderName = payload.payload?.username;
        
        // Check if the sender is one of our friends
        const isFriend = authFriends.some((f) => f.id === senderId);
        
        if (isFriend) {
          console.log(`CineTrack Realtime: Received movie update from @${senderName}. Refreshing...`);
          refetchRef.current();
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("CineTrack Realtime: Subscribed successfully!");
          syncChannelRef.current = channel;
        }
      });

    return () => {
      console.log("CineTrack Realtime: Cleaning up global sync subscription...");
      supabase?.removeChannel(channel);
    };
  }, [user?.id, authFriends]);

  const broadcastMovieChange = useCallback(() => {
    if (syncChannelRef.current && user) {
      console.log("CineTrack Realtime: Publishing movie_changed event...");
      syncChannelRef.current.send({
        type: "broadcast",
        event: "movie_changed",
        payload: { senderId: user.id, username: profile?.username || user.email },
      });
    }
  }, [user?.id, profile?.username, user?.email]);

  // Helper to ensure the Supabase auth token is fresh before any database mutations
  const ensureFreshSession = async () => {
    if (!supabase) return null;
    try {
      console.log("CineTrack [Diagnostics]: Running getSession with a 3-second timeout guard...");
      
      // We set a 3-second timeout limit for Supabase session checks to prevent thread locks
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<{ data: { session: any } }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth session request timed out")), 3000)
      );

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
      console.log("CineTrack [Diagnostics]: getSession resolved successfully.");
      if (session) {
        return session;
      }
    } catch (err: any) {
      console.warn("CineTrack [Diagnostics]: Session verification timed out or failed, proceeding with caution:", err);
      // Proceed instead of blocking, so the user can still attempt database writes or local operations
    }
    return null;
  };

  // Collaborative Co-Watching — use real auth friends (display names) + self
  // Collaborative Co-Watching — use real auth friends (display names) + self
  const myName = profile?.display_name || profile?.username || "Me";

  // Helper to convert user_id to display name
  const getUserNameById = useCallback((uid?: string | null) => {
    if (!uid) return "Unknown";
    if (uid === user?.id) return myName;
    const friend = authFriends.find((f) => f.id === uid);
    return friend ? (friend.display_name || friend.username) : "Friend";
  }, [user?.id, myName, authFriends]);

  // Compute active merged co-watch group members
  const mergedFriendships = useMemo(() => {
    return (friendships || []).filter(
      (fs) => fs.status === "accepted" && fs.merge_status === "accepted"
    );
  }, [friendships]);

  const mergedFriends = useMemo(() => {
    return authFriends.filter((f) =>
      mergedFriendships.some((fs) => fs.requester_id === f.id || fs.addressee_id === f.id)
    );
  }, [authFriends, mergedFriendships]);

  const coWatchGroupUserIds = useMemo(() => {
    return [user?.id, ...mergedFriends.map((f) => f.id)].filter(Boolean) as string[];
  }, [user?.id, mergedFriends]);

  // friends is the co-watch group display names (Me + active merged friends)
  const friends = useMemo(() => {
    return [myName, ...mergedFriends.map((f) => f.display_name || f.username)];
  }, [myName, mergedFriends]);

  const [watchedViewMode, setWatchedViewMode] = useState<"co-watched" | string>("co-watched");





  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);



  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    setToast({ message, type });
  };

  // 🔴 Refetch movies from MongoDB API endpoint
  const refetchMovies = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/movies?userIds=${encodeURIComponent(coWatchGroupUserIds.join(","))}`);
      if (!response.ok) throw new Error("Failed to fetch movies from MongoDB");
      const { results } = await response.json();
      if (!results) return;

      const rowsByTmdbId = new Map<string, Movie[]>();
      for (const row of results as Movie[]) {
        const key = row.tmdb_id;
        const existingList = rowsByTmdbId.get(key) || [];
        existingList.push(row);
        rowsByTmdbId.set(key, existingList);
      }

      const mergedMovies: Movie[] = [];
      for (const [tmdbId, rows] of rowsByTmdbId.entries()) {
        const unwatchedRow = rows.find((r) => !r.watched);
        const canonicalRow = unwatchedRow || rows[0];

        const watchedByNames = rows.filter((r) => r.watched).map((r) => getUserNameById(r.user_id));
        const watchedByStr = Array.from(new Set(watchedByNames)).sort().join(", ");

        const pendingNames = friends.filter((name) => !watchedByNames.includes(name));
        const allHaveWatched = pendingNames.length === 0;

        const addedByUserId = unwatchedRow?.user_id || rows[rows.length - 1]?.user_id;
        const addedByName = getUserNameById(addedByUserId);

        mergedMovies.push({
          ...canonicalRow,
          watched: allHaveWatched,
          watched_by: watchedByStr,
          rating: rows.find((r) => r.user_id === user.id)?.rating ?? canonicalRow.rating,
          review: rows.find((r) => r.user_id === user.id)?.review ?? canonicalRow.review,
          ratings_json: JSON.stringify(
            rows.map((r) => ({
              username: getUserNameById(r.user_id),
              rating: r.rating,
              review: r.review,
              watched: r.watched
            }))
          ),
          reviews_json: addedByName,
          id: rows.find((r) => r.user_id === user.id)?.id || canonicalRow.id,
          user_id: user.id
        });
      }

      // 🟢 Enforce strict descending chronological sort (newest additions at the very top)
      mergedMovies.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      setMovies(mergedMovies);
      localStorage.setItem("cinetrack_movies_cache", JSON.stringify(mergedMovies));
    } catch (e) {
      console.error("CineTrack [MongoDB GET Error]:", e);
    }
  }, [user?.id, coWatchGroupUserIds, friends]);

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
        } else {
          const localData = localStorage.getItem(`cinetrack_movies_local`);
          setMovies(localData ? JSON.parse(localData) : []);
        }

        // Fetch Activities
        const localActs = localStorage.getItem("cinetrack_activities");
        if (localActs) {
          setActivities(JSON.parse(localActs));
        } else {
          setActivities([]);
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



  // Save changes helper (synces back locally if Supabase is disabled)
  const saveMoviesState = async (newMovies: Movie[]) => {
    setMovies(newMovies);
    localStorage.setItem(`cinetrack_movies_${user?.id || "local"}`, JSON.stringify(newMovies));
  };

  // Add a new activity log
  const logActivity = (type: ActivityLog["type"], title: string, category: string, details: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      category,
      timestamp: new Date().toISOString(),
      details
    };
    const updated = [newLog, ...activities].slice(0, 15); // cap at 15 items
    setActivities(updated);
    localStorage.setItem("cinetrack_activities", JSON.stringify(updated));
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
      let category = tmdbMovie.category || "Movie";
      let global_rating: number | null = tmdbMovie.vote_average || null;
      let genres: string | null = null;

      try {
        console.log("CineTrack [Diagnostics]: Fetching details from TMDB proxy...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn("CineTrack [Diagnostics]: TMDB proxy request timed out after 4 seconds.");
          controller.abort();
        }, 4000); // 4-second timeout limit

        const detailsRes = await fetch(
          `/api/tmdb?movieId=${tmdbMovie.id}&mediaType=${tmdbMovie.media_type || "movie"}`,
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
          if (detailsData.category) {
            category = detailsData.category;
          }
          if (detailsData.vote_average !== undefined) {
            global_rating = detailsData.vote_average;
          }
          if (detailsData.genres) {
            genres = detailsData.genres.map((g: any) => g.name).join(", ");
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
        release_year: tmdbMovie.release_date ? tmdbMovie.release_date.split("-")[0] : "N/A",
        runtime,
        synopsis: tmdbMovie.overview || null,
        watched,
        rating: null,
        review: null,
        seasons,
        category,
        global_rating,
        genres,
        watched_by: watched ? myName : "",
        ratings_json: "{}",
        user_id: user?.id || null,
        created_at: new Date().toISOString(),
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
        watched ? "Added directly to Watched Collection" : "Queued in Unwatched list"
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
      let category = tmdbMovie.category || "Movie";
      let global_rating: number | null = tmdbMovie.vote_average || null;
      let genres: string | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout limit per fetch

        const detailsRes = await fetch(
          `/api/tmdb?movieId=${tmdbMovie.id}&mediaType=${tmdbMovie.media_type || "movie"}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.runtime) runtime = detailsData.runtime;
          if (detailsData.seasons !== undefined) seasons = detailsData.seasons;
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
        category,
        global_rating,
        genres,
        watched_by: watched ? myName : "",
        ratings_json: "{}",
        user_id: user?.id || null,
        created_at: new Date().toISOString(),
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
          `Batch imported ${importedEntries.length} titles from list.`
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
        category: targetMovie.category,
        global_rating: targetMovie.global_rating,
        genres: targetMovie.genres,
        user_id: user?.id,
        watched_by: "",
        ratings_json: "{}",
        reviews_json: "{}",
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
          ? "Marked as watched by you"
          : "Moved back to your Unwatched list"
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

  // 2b. Collaborative Season Completion Toggle
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
      logActivity("delete", targetMovie.title, targetMovie.category, "Removed from library");

      showToast(`Removed "${targetMovie.title}" from library.`, "info");
    } catch (err) {
      console.error("Failed to delete movie:", err);
      showToast("Error removing movie.", "warning");
    }
  };

  const handleCreateCustomMovie = async (movieData: any) => {
    if (!user) return;
    try {
      const myName = profile?.display_name || profile?.username || "Me";
      
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
        category: movieData.category,
        global_rating: null,
        genres: movieData.genres,
        watched_by: movieData.watched ? myName : "",
        ratings_json: "{}",
        reviews_json: myName, // Store creator name in reviews_json (Added by...)
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
        newEntry.watched ? "Added custom title directly to Watched Collection" : "Queued custom title in Unwatched list"
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
      logActivity("rate", targetMovie.title, targetMovie.category, `${friendName} rated it ${rating}/5 stars`);
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
        `${friendName} updated thoughts: "${review.length > 25 ? `${review.substr(0, 25)}...` : review}"`
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

      await saveMoviesState([]);
      setActivities([]);
      localStorage.removeItem("cinetrack_activities");
      showToast("Cleared your entire tracking library.", "warning");
    } catch (err) {
      console.error("Failed to clear database:", err);
      showToast("Error clearing database.", "warning");
    }
  };

  // === 3-TIER LIST LOGIC ===
  const baseUnwatchedList = movies.filter((m) => {
    if (m.watched) return false;
    const watchedBy = m.watched_by ? m.watched_by.split(", ").filter(Boolean) : [];
    return !watchedBy.includes(myName);
  });

  // MY WATCHED: movies where the current user personally has watched=true
  // In our data model, m.watched=true only when ALL group members have watched it
  // So for "my watched" we check if myName is in watched_by
  const baseMyWatchedList = movies.filter((m) => {
    const watchedBy = m.watched_by ? m.watched_by.split(", ").filter(Boolean) : [];
    return watchedBy.includes(myName);
  });

  // COMMON WATCHED: movies where ALL members in the co-watch group have watched
  const baseCommonWatchedList = movies.filter((m) => m.watched);

  // Backward-compat: baseWatchedList = common watched (all friends watched)
  const baseWatchedList = watchedViewMode === "co-watched"
    ? baseCommonWatchedList
    : movies.filter((m) => {
        const watchedBy = m.watched_by ? m.watched_by.split(", ").filter(Boolean) : [];
        return watchedBy.includes(watchedViewMode);
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

  // Filter lists based on type, genres, formats and local searches
  const unwatchedList = baseUnwatchedList
    .filter((m) => m.title.toLowerCase().includes(unwatchedFilter.trim().toLowerCase()))
    .filter((m) => {
      if (!unwatchedGenreFilter) return true;
      return m.genres && m.genres.split(", ").includes(unwatchedGenreFilter);
    })
    .filter((m) => {
      if (!unwatchedCategoryFilter) return true;
      return m.category === unwatchedCategoryFilter;
    });

  const watchedList = baseWatchedList
    .filter((m) => m.title.toLowerCase().includes(watchedFilter.trim().toLowerCase()))
    .filter((m) => {
      if (!watchedGenreFilter) return true;
      return m.genres && m.genres.split(", ").includes(watchedGenreFilter);
    })
    .filter((m) => {
      if (!watchedCategoryFilter) return true;
      return m.category === watchedCategoryFilter;
    });

  const totalWatchedRuntime = baseMyWatchedList.reduce((acc, curr) => acc + (curr.runtime || 0), 0);

  return (
    <div className="w-full bg-zinc-950 min-h-screen text-zinc-100 flex flex-col md:flex-row antialiased">
      {/* Decorative Glow Bubbles */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-96 h-96 bg-emerald-500/3 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Sleek LEFT Sidebar Container */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-900 bg-zinc-950/90 backdrop-blur-md flex-shrink-0 flex flex-col justify-between py-6 px-4 z-40 select-none md:sticky md:top-0 md:h-screen">
        <div className="space-y-7">
          {/* Logo Heading */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                CineTrack
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold -mt-0.5">Media Logger</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-zinc-900 text-white border-l-2 border-indigo-500 pl-4"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard Home
            </button>

            <button
              onClick={() => {
                setActiveTab("unwatched");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "unwatched"
                  ? "bg-zinc-900 text-white border-l-2 border-amber-500 pl-4"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <Compass className="w-4 h-4" />
                Unwatched Queue
              </span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/10 rounded-full">
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : baseUnwatchedList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("watched");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "watched"
                  ? "bg-zinc-900 text-white border-l-2 border-emerald-500 pl-4"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <Trophy className="w-4 h-4" />
                Watched Collection
              </span>
            </button>

            {searchTabQuery && (
              <button
                onClick={() => {
                  setActiveTab("search_results");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "search_results"
                    ? "bg-zinc-900 text-white border-l-2 border-indigo-500 pl-4"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-indigo-400" />
                  Search Results
                </span>
                <span className="text-[9px] font-extrabold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded-full">
                  Active
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* User Profile Card + Friends Panel + Sign Out */}
        <div className="space-y-3 pt-5 border-t border-zinc-900 px-1">
          {/* Friends Toggle Button */}
          <button
            onClick={() => setShowFriendsPanel(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/60 text-zinc-300 hover:text-white transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <Users className="w-4 h-4 text-indigo-400" />
              Friends
            </span>
            <div className="flex items-center gap-1.5">
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-500 text-white text-[8px] font-extrabold rounded-full">
                  {pendingRequests.length}
                </span>
              )}
              <span className="text-[10px] text-zinc-500 font-bold">{authFriends.length}</span>
            </div>
          </button>

          {/* Profile Card */}
          {profile && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0"
                style={{ backgroundColor: profile.avatar_color || "#6366f1" }}
              >
                {(profile.display_name || profile.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 truncate">{profile.display_name}</p>
                <p className="text-[9px] text-zinc-500 font-medium">@{profile.username}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

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


      {/* Right Work Workspace Area */}
      <main className="flex-grow p-4 md:p-8 max-w-6xl w-full flex flex-col gap-6 overflow-x-hidden">
        
        {/* Sleek Global TMDB Search Bar */}
        <div className="w-full max-w-2xl mx-auto flex items-center gap-3 relative">
          <div className="flex-1">
            <SearchBar 
              onAddMovie={handleAddMovie} 
              isTracked={isTracked} 
              onSearchSubmit={(q) => handleSearchSubmit(q, 1)}
            />
          </div>
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
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
                unwatchedCount={baseUnwatchedList.length}
                myWatchedCount={baseMyWatchedList.length}
                coWatchedCount={baseCommonWatchedList.length}
                totalRuntime={totalWatchedRuntime}
              />
            )}



            {/* Recent Activity Feed */}
            <div className="w-full bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-900 select-none">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" /> Recent Activity Feed
                  </h3>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">
                    {activities.length} logs
                  </span>
                </div>

                {activities.length === 0 ? (
                  <div className="py-16 text-center select-none">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500 text-lg mb-2">
                      🪵
                    </div>
                    <h4 className="text-xs font-bold text-zinc-400">Activity timeline empty</h4>
                    <p className="text-[9px] text-zinc-600 mt-0.5">Add, watch, or rate movies to start logging timeline events.</p>
                  </div>
                ) : (
                  <div className="relative mt-4 pl-4 space-y-4 border-l border-zinc-850 max-h-[300px] overflow-y-auto pr-1">
                    {activities.map((act) => (
                      <div key={act.id} className="relative group/timeline select-none">
                        {/* Timeline Bullet Ring */}
                        <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border bg-zinc-950 ${
                          act.type === "add"
                            ? "border-indigo-500 text-indigo-500"
                            : act.type === "watch"
                            ? "border-emerald-500 text-emerald-500"
                            : act.type === "unwatch"
                            ? "border-amber-500 text-amber-500"
                            : act.type === "delete"
                            ? "border-red-500 text-red-500"
                            : "border-purple-500 text-purple-400"
                        }`} />

                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-200">
                                {act.title}
                              </span>
                              {act.category && (
                                <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${
                                  act.category === "Anime"
                                    ? "bg-purple-500/10 text-purple-400"
                                    : act.category === "TV Show"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : act.category === "Animated Movie"
                                    ? "bg-indigo-500/10 text-indigo-400"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}>
                                  {act.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{act.details}</p>
                          </div>
                          
                          <span className="text-[9px] text-zinc-600 font-semibold flex-shrink-0 mt-0.5">
                            {formatTimeAgo(act.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                      {format.label}
                    </button>
                  );
                })}
              </div>

              {/* Genre pills */}
              {unwatchedGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mr-2 select-none">Genre:</span>
                  <button
                    onClick={() => setUnwatchedGenreFilter("")}
                    className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all active:scale-95 duration-250 ${
                      unwatchedGenreFilter === ""
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10"
                        : "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    All Genres
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
                        {genre}
                      </button>
                    );
                  })}
                </div>
              )}
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
                <h4 className="text-sm font-bold text-zinc-400">No items found in your queue</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {unwatchedFilter 
                    ? `No logged unwatched items match "${unwatchedFilter}". Try searching something else.`
                    : "Your queue is completely empty. Search above or trending banner on Home Tab to log titles."}
                </p>
              </div>
            ) : (
              /* High-end Multi-column Grid Layout (2 columns on md, 3 on xl) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unwatchedList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onDeleteMovie={handleDeleteMovie}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
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

            {/* Co-Watch Shelf View Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
              <span className="text-[8.5px] font-extrabold text-zinc-550 uppercase tracking-widest mr-1.5 flex items-center gap-1 flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> Shelf Mode:
              </span>
              
              <button
                onClick={() => setWatchedViewMode("co-watched")}
                className={`px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 duration-200 flex-shrink-0 ${
                  watchedViewMode === "co-watched"
                    ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                👥 {friends.length === 2 ? "Watched by Both" : friends.length > 2 ? "Watched by Everyone" : "Watched by Me"}
              </button>

              {(friends.length > 0 ? friends : ["Me"]).map((friend) => (
                <button
                  key={friend}
                  onClick={() => setWatchedViewMode(friend)}
                  className={`px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 duration-200 flex-shrink-0 ${
                    watchedViewMode === friend
                      ? "bg-zinc-900 text-emerald-450 border border-emerald-500/20 font-bold shadow-sm shadow-emerald-500/5"
                      : "bg-zinc-900/50 border border-zinc-900/60 text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  👤 {friend === myName || friend === "Me" ? "My Watch List" : `${friend}'s Watch List`}
                </button>
              ))}
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
                      {format.label}
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
                    All Genres
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
                        {genre}
                      </button>
                    );
                  })}
                </div>
              )}
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
              /* High-end Multi-column Grid Layout (2 columns on md, 3 on xl) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchedList.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    friends={friends}
                    myName={myName}
                    onToggleFriendWatched={handleToggleFriendWatched}
                    onDeleteMovie={handleDeleteMovie}
                    onUpdateFriendRating={handleUpdateFriendRating}
                    onUpdateFriendReview={handleUpdateFriendReview}
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
                    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
                    const posterUrl = movie.poster_path
                      ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
                      : "";
                    const movieTracked = isTracked(movie.id.toString());

                    return (
                      <article key={movie.id} className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl hover:border-zinc-750 hover:bg-zinc-900/90 transition-all duration-300 shadow-sm group">
                        {/* Poster Thumbnail */}
                        <div className="w-[84px] h-[120px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-850 shadow-sm flex-shrink-0 relative select-none flex items-center justify-center">
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
                            <h3 className="text-sm font-black text-zinc-100 line-clamp-2 leading-tight" title={movie.title}>
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
                              <span>{year}</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                              <span className="text-amber-500 font-semibold">⭐ {rating}</span>
                            </div>

                            {movie.overview && (
                              <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed select-text">
                                {movie.overview}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons to Add */}
                          <div className="mt-3 flex items-center gap-2 select-none">
                            {movieTracked ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-950 text-zinc-550 text-[10px] font-bold rounded-xl border border-zinc-850/80 shadow-inner select-none w-full justify-center">
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
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-950 text-[10px] font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                                >
                                  🏆 + Watched
                                </button>
                              </>
                            )}
                          </div>
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

      </main>

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

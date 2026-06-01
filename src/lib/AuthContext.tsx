"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase, isSupabaseConfigured, Profile, Friendship } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  friends: Profile[];
  friendships: Friendship[];
  pendingRequests: Friendship[];
  loading: boolean;
  authLoading: boolean;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  sendFriendRequest: (username: string) => Promise<{ error: string | null }>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  requestMergeLists: (friendProfileId: string) => Promise<void>;
  acceptMergeLists: (friendProfileId: string) => Promise<void>;
  rejectMergeLists: (friendProfileId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Load session from local cache optimistically so page opens in 0ms!
  useEffect(() => {
    const savedUser = localStorage.getItem("cinetrack_cached_user");
    const savedProfile = localStorage.getItem("cinetrack_cached_profile");
    const savedFriends = localStorage.getItem("cinetrack_cached_friends");
    const savedFriendships = localStorage.getItem("cinetrack_cached_friendships");
    const savedPending = localStorage.getItem("cinetrack_cached_pending");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (savedProfile) setProfile(JSON.parse(savedProfile));
        if (savedFriends) setFriends(JSON.parse(savedFriends));
        if (savedFriendships) setFriendships(JSON.parse(savedFriendships));
        if (savedPending) setPendingRequests(JSON.parse(savedPending));
        setLoading(false); // Instantly open dashboard!
      } catch (e) {
        console.error("Failed parsing cached auth state:", e);
      }
    }
  }, []);

  const AVATAR_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
    "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
  ];

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data as Profile);
      localStorage.setItem("cinetrack_cached_profile", JSON.stringify(data));
    }
  }, []);

  const refreshFriends = useCallback(async (overrideUserId?: string) => {
    const targetUserId = overrideUserId || user?.id;
    if (!supabase || !targetUserId) return;

    // Fetch accepted friendships
    const { data: friendshipsData, error: friendshipsError } = await supabase
      .from("friendships")
      .select(`
        id, requester_id, addressee_id, status, merge_status, merge_requester_id, created_at,
        requester:profiles!requester_id(id, username, display_name, avatar_color, created_at),
        addressee:profiles!addressee_id(id, username, display_name, avatar_color, created_at)
      `)
      .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
      .eq("status", "accepted");

    if (friendshipsError) {
      console.error("Error fetching accepted friendships:", friendshipsError.message);
    }

    if (friendshipsData) {
  const mappedFriendships: Friendship[] = friendshipsData.map((f: any) => ({
    ...f,
    requester: Array.isArray(f.requester)
      ? f.requester[0]
      : f.requester,
    addressee: Array.isArray(f.addressee)
      ? f.addressee[0]
      : f.addressee,
  }));

  setFriendships(mappedFriendships);

  localStorage.setItem(
    "cinetrack_cached_friendships",
    JSON.stringify(mappedFriendships)
  );

  const friendProfiles = mappedFriendships
    .map((f) =>
      f.requester_id === targetUserId
        ? f.addressee
        : f.requester
    )
    .filter((p): p is Profile => p !== undefined);

  setFriends(friendProfiles);
  localStorage.setItem(
    "cinetrack_cached_friends",
    JSON.stringify(friendProfiles)
  );
} else {
      setFriendships([]);
      setFriends([]);
    }

    // Fetch pending requests sent TO me
    const { data: pending, error: pendingError } = await supabase
      .from("friendships")
      .select(`
        id, requester_id, addressee_id, status, created_at,
        requester:profiles!requester_id(id, username, display_name, avatar_color, created_at)
      `)
      .eq("addressee_id", targetUserId)
      .eq("status", "pending");

    if (pendingError) {
      console.error("Error fetching pending requests:", pendingError.message);
    }

    if (pending) {
      const mappedPending = pending.map((req: any) => {
        const rawReq = req.requester;
        const requesterObj = Array.isArray(rawReq) ? rawReq[0] : rawReq;
        return {
          ...req,
          requester: requesterObj
        };
      });
      setPendingRequests(mappedPending as Friendship[]);
      localStorage.setItem("cinetrack_cached_pending", JSON.stringify(mappedPending));
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        localStorage.setItem("cinetrack_cached_user", JSON.stringify(session.user));
        await Promise.all([
          fetchProfile(session.user.id),
          refreshFriends(session.user.id)
        ]);
      } else {
        localStorage.removeItem("cinetrack_cached_user");
        localStorage.removeItem("cinetrack_cached_profile");
        localStorage.removeItem("cinetrack_cached_friends");
        localStorage.removeItem("cinetrack_cached_friendships");
        localStorage.removeItem("cinetrack_cached_pending");
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          localStorage.setItem("cinetrack_cached_user", JSON.stringify(session.user));
          await Promise.all([
            fetchProfile(session.user.id),
            refreshFriends(session.user.id)
          ]);
        } else {
          setProfile(null);
          setFriends([]);
          setPendingRequests([]);
          localStorage.removeItem("cinetrack_cached_user");
          localStorage.removeItem("cinetrack_cached_profile");
          localStorage.removeItem("cinetrack_cached_friends");
          localStorage.removeItem("cinetrack_cached_friendships");
          localStorage.removeItem("cinetrack_cached_pending");
          localStorage.removeItem("cinetrack_movies_cache");
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load friends whenever user changes
  useEffect(() => {
    if (user) refreshFriends();
  }, [user, refreshFriends]);

  // Keep a ref to the latest refreshFriends function to avoid rebuild loops
  const refreshFriendsRef = React.useRef(refreshFriends);
  useEffect(() => {
    refreshFriendsRef.current = refreshFriends;
  }, [refreshFriends]);

  // 🔴 Realtime + polling for instant friend request notifications
 useEffect(() => {
  if (!supabase || !user) return;

  const sb = supabase;

  const channel = sb
    .channel(`friendships_realtime_${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
      },
      () => {
        refreshFriendsRef.current();
      }
    )
    .subscribe();

  const pollInterval = setInterval(() => {
    refreshFriendsRef.current();
  }, 8000);

  return () => {
    sb.removeChannel(channel);
    clearInterval(pollInterval);
  };
}, [user?.id]);


  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ): Promise<{ error: string | null }> => {
    if (!supabase) return { error: "Supabase not configured." };
    setAuthLoading(true);

    try {
      // Check username is unique
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (existing) {
        return { error: "Username is already taken. Please choose another." };
      }

      // Sign up — email confirmation disabled in Supabase dashboard
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        await supabase.from("profiles").insert([{
          id: data.user.id,
          username: username.toLowerCase(),
          display_name: displayName || username,
          avatar_color: avatarColor,
        }]);

        // Auto sign-in immediately (works when email confirmation is disabled)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) return { error: signInError.message };
      }

      return { error: null };
    } finally {
      setAuthLoading(false);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    if (!supabase) return { error: "Supabase not configured." };
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setFriends([]);
    setPendingRequests([]);
    localStorage.removeItem("cinetrack_cached_user");
    localStorage.removeItem("cinetrack_cached_profile");
    localStorage.removeItem("cinetrack_cached_friends");
    localStorage.removeItem("cinetrack_cached_friendships");
    localStorage.removeItem("cinetrack_cached_pending");
    localStorage.removeItem("cinetrack_movies_cache");
  };

  const sendFriendRequest = async (
    username: string
  ): Promise<{ error: string | null }> => {
    if (!supabase || !user) return { error: "Not authenticated." };

    // Find user by username
    const { data: target } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username.toLowerCase())
      .single();

    if (!target) return { error: `No user found with username "@${username}".` };
    if (target.id === user.id) return { error: "You cannot add yourself as a friend." };

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`
      )
      .single();

    if (existing) {
      if (existing.status === "accepted") return { error: "You are already friends!" };
      if (existing.status === "pending") return { error: "A friend request already exists." };
    }

    const { error } = await supabase.from("friendships").insert([{
      requester_id: user.id,
      addressee_id: target.id,
      status: "pending",
    }]);

    if (error) return { error: error.message };
    await refreshFriends();
    return { error: null };
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    if (!supabase) return;
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    await refreshFriends();
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    if (!supabase) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await refreshFriends();
  };

  const removeFriend = async (friendProfileId: string) => {
    if (!supabase || !user) return;
    // Find the friendship record involving both users
    const { data } = await supabase
      .from("friendships")
      .select("id")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${friendProfileId}),and(requester_id.eq.${friendProfileId},addressee_id.eq.${user.id})`
      )
      .single();
    if (data) {
      await supabase.from("friendships").delete().eq("id", data.id);
    }
    await refreshFriends();
  };

  const requestMergeLists = async (friendProfileId: string) => {
    if (!supabase || !user) return;
    try {
      const { data } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendProfileId}),and(requester_id.eq.${friendProfileId},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (data) {
        const { error } = await supabase
          .from("friendships")
          .update({
            merge_status: "pending",
            merge_requester_id: user.id
          })
          .eq("id", data.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("requestMergeLists failed:", err);
    }
    await refreshFriends();
  };

  const acceptMergeLists = async (friendProfileId: string) => {
    if (!supabase || !user) return;
    try {
      const { data } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendProfileId}),and(requester_id.eq.${friendProfileId},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (data) {
        const { error } = await supabase
          .from("friendships")
          .update({
            merge_status: "accepted"
          })
          .eq("id", data.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("acceptMergeLists failed:", err);
    }
    await refreshFriends();
  };

  const rejectMergeLists = async (friendProfileId: string) => {
    if (!supabase || !user) return;
    try {
      const { data } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendProfileId}),and(requester_id.eq.${friendProfileId},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (data) {
        const { error } = await supabase
          .from("friendships")
          .update({
            merge_status: "none",
            merge_requester_id: null
          })
          .eq("id", data.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("rejectMergeLists failed:", err);
    }
    await refreshFriends();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        friends,
        friendships,
        pendingRequests,
        loading,
        authLoading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        refreshFriends,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        requestMergeLists,
        acceptMergeLists,
        rejectMergeLists,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Profile, Friendship } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_color: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  friends: Profile[];
  friendships: Friendship[];
  pendingRequests: Friendship[];
  loading: boolean;
  authLoading: boolean;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: string | null; verificationSent?: boolean }>;
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
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
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

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          const userProfile: Profile = {
            id: data.user.id,
            username: data.user.username,
            display_name: data.user.display_name,
            avatar_color: data.user.avatar_color,
            created_at: data.user.created_at,
            role: data.user.role
          };
          setProfile(userProfile);
          localStorage.setItem("cinetrack_cached_user", JSON.stringify(data.user));
          localStorage.setItem("cinetrack_cached_profile", JSON.stringify(userProfile));
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    } catch (err) {
      console.error("refreshProfile failed:", err);
    }
  }, []);

  const refreshFriends = useCallback(async (overrideUserId?: string) => {
    const targetUserId = overrideUserId || user?.id;
    if (!targetUserId) return;

    try {
      const res = await fetch("/api/friendships");
      if (!res.ok) throw new Error("Failed to fetch friendships");
      const data = await res.json();

      if (data.results) {
        const allFriendships: Friendship[] = data.results;
        
        // Accepted friendships
        const accepted = allFriendships.filter(f => f.status === "accepted");
        setFriendships(accepted);
        localStorage.setItem("cinetrack_cached_friendships", JSON.stringify(accepted));

        const friendProfiles = accepted
          .map((f) => f.requester_id === targetUserId ? f.addressee : f.requester)
          .filter((p): p is Profile => p !== undefined);

        setFriends(friendProfiles);
        localStorage.setItem("cinetrack_cached_friends", JSON.stringify(friendProfiles));

        // Pending requests received
        const pending = allFriendships.filter(f => f.status === "pending" && f.addressee_id === targetUserId);
        setPendingRequests(pending);
        localStorage.setItem("cinetrack_cached_pending", JSON.stringify(pending));
      }
    } catch (err) {
      console.error("refreshFriends failed:", err);
    }
  }, [user?.id]);

  // Initial check on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.authenticated && data.user) {
              setUser(data.user);
              const userProfile: Profile = {
                id: data.user.id,
                username: data.user.username,
                display_name: data.user.display_name,
                avatar_color: data.user.avatar_color,
                created_at: data.user.created_at,
                role: data.user.role
              };
              setProfile(userProfile);
              localStorage.setItem("cinetrack_cached_user", JSON.stringify(data.user));
              localStorage.setItem("cinetrack_cached_profile", JSON.stringify(userProfile));
              await refreshFriends(data.user.id);
            } else {
              setUser(null);
              setProfile(null);
              setFriends([]);
              setFriendships([]);
              setPendingRequests([]);
              localStorage.removeItem("cinetrack_cached_user");
              localStorage.removeItem("cinetrack_cached_profile");
              localStorage.removeItem("cinetrack_cached_friends");
              localStorage.removeItem("cinetrack_cached_friendships");
              localStorage.removeItem("cinetrack_cached_pending");
              localStorage.removeItem("cinetrack_movies_cache");
            }
          }
        }
      } catch (err) {
        console.error("Error in checkAuth:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for friends update (instant sync replacement)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshFriends();
    }, 8000);

    return () => clearInterval(interval);
  }, [user, refreshFriends]);

  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ): Promise<{ error: string | null; verificationSent?: boolean }> => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username, display_name: displayName })
      });
      const data = await res.json();
      
      if (!res.ok) {
        return { error: data.error || "Signup failed." };
      }

      return { error: null, verificationSent: true };
    } catch (err: any) {
      return { error: err.message || "An unexpected error occurred." };
    } finally {
      setAuthLoading(false);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed." };
      }

      if (data.success && data.user) {
        setUser(data.user);
        const userProfile: Profile = {
          id: data.user.id,
          username: data.user.username,
          display_name: data.user.display_name,
          avatar_color: data.user.avatar_color,
          created_at: data.user.created_at,
          role: data.user.role
        };
        setProfile(userProfile);
        localStorage.setItem("cinetrack_cached_user", JSON.stringify(data.user));
        localStorage.setItem("cinetrack_cached_profile", JSON.stringify(userProfile));
        await refreshFriends(data.user.id);
        return { error: null };
      }

      return { error: "Invalid response from server" };
    } catch (err: any) {
      return { error: err.message || "An unexpected error occurred." };
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {}
    
    setUser(null);
    setProfile(null);
    setFriends([]);
    setFriendships([]);
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
    if (!user) return { error: "Not authenticated." };
    try {
      const res = await fetch("/api/friendships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || "Failed to send request" };
      }
      await refreshFriends();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to send friend request." };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      await fetch("/api/friendships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "accept" })
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    try {
      await fetch("/api/friendships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "reject" })
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const removeFriend = async (friendProfileId: string) => {
    try {
      await fetch(`/api/friendships?friendProfileId=${friendProfileId}`, {
        method: "DELETE"
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const requestMergeLists = async (friendProfileId: string) => {
    try {
      await fetch("/api/friendships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendProfileId, action: "request_merge" })
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const acceptMergeLists = async (friendProfileId: string) => {
    try {
      await fetch("/api/friendships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendProfileId, action: "accept_merge" })
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const rejectMergeLists = async (friendProfileId: string) => {
    try {
      await fetch("/api/friendships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendProfileId, action: "reject_merge" })
      });
      await refreshFriends();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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

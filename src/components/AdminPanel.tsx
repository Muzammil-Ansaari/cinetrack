"use client";

import React, { useState, useEffect } from "react";
import { Users, Shield, Check, X, Trash2, ShieldAlert, RefreshCw, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface ManagedUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_color: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users?listAll=true");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch users");
      }
      const data = await res.json();
      setUsers(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleVerify = async (userId: string, currentStatus: boolean) => {
    setActionLoading(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, is_verified: !currentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Operation failed");
      
      setSuccess(`User verification status updated!`);
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, is_verified: !currentStatus } : u));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Operation failed");
      
      setSuccess(`User role updated to ${newRole}!`);
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you absolutely sure you want to delete user @${username}? This will erase all of their movies, friendships, and history logs permanently!`)) {
      return;
    }

    setActionLoading(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/users?userId=${userId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      
      setSuccess(`User @${username} and all of their data has been deleted!`);
      // Remove from local state
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Shield className="w-5 h-5 text-indigo-400" /> Administrative User Management
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Admin roles can verify users. Superadmins can promote/demote and delete accounts.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-250 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Info messages */}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Search and stats bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search users by username, email, display name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900/60 border border-zinc-800 hover:border-zinc-750 focus:border-indigo-500 focus:outline-none rounded-xl text-xs text-zinc-200 placeholder:text-zinc-650 transition-all font-medium"
          />
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase select-none">
          <div>Total Users: <span className="text-zinc-300">{users.length}</span></div>
          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
          <div>Verified: <span className="text-emerald-500">{users.filter(u => u.is_verified).length}</span></div>
          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
          <div>Admins: <span className="text-indigo-400">{users.filter(u => u.role !== "user").length}</span></div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-zinc-550">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-xs font-bold mt-2.5">Retrieving user database records...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-24 text-center">
            <Users className="w-10 h-10 text-zinc-800 mx-auto mb-2" />
            <p className="text-sm font-bold text-zinc-500">No users found</p>
            <p className="text-xs text-zinc-650 mt-1">Try refining your search terms or verify connection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-850/60 text-[9px] font-black uppercase text-zinc-500 tracking-wider bg-zinc-950/20">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/40 text-xs">
                {filteredUsers.map((item) => {
                  const initials = (item.display_name || item.username)
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  const isSelf = currentUser?.id === item.id;
                  const isSuperadmin = item.role === "superadmin";
                  const isAdmin = item.role === "admin";

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/10 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[11px] text-white flex-shrink-0"
                          style={{ backgroundColor: item.avatar_color || "#6366f1" }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-zinc-200 flex items-center gap-1.5">
                            <span>{item.display_name}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-extrabold text-[8px] uppercase tracking-wide">
                                Me
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500">@{item.username}</div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-zinc-300 font-medium">
                        {item.email}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 font-bold">
                        {isSuperadmin ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[9px] uppercase tracking-wide">
                            Super Admin
                          </span>
                        ) : isAdmin ? (
                          <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/25 text-violet-400 text-[9px] uppercase tracking-wide">
                            Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-800 text-zinc-450 text-[9px] uppercase tracking-wide">
                            User
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {item.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wide">
                            ✓ Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase tracking-wide animate-pulse">
                            ⚠ Pending
                          </span>
                        )}
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-zinc-500 text-[10px] font-medium">
                        {new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {actionLoading === item.id ? (
                            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin mr-2" />
                          ) : (
                            <>
                              {/* Toggle Verification (available to Admin & Superadmin) */}
                              {!isSelf && (
                                <button
                                  onClick={() => handleToggleVerify(item.id, item.is_verified)}
                                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
                                    item.is_verified
                                      ? "bg-zinc-900 border-zinc-800 text-zinc-450 hover:bg-zinc-850 hover:text-zinc-200"
                                      : "bg-emerald-600/10 hover:bg-emerald-600/20 border-emerald-500/20 text-emerald-400"
                                  }`}
                                  title={item.is_verified ? "Revoke Verification" : "Mark as Verified"}
                                >
                                  {item.is_verified ? "Unverify" : "Verify"}
                                </button>
                              )}

                              {/* Promotion/Demotion (Superadmin Only) */}
                              {currentUser?.role === "superadmin" && !isSelf && !isSuperadmin && (
                                <button
                                  onClick={() => handleRoleChange(item.id, isAdmin ? "user" : "admin")}
                                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
                                    isAdmin
                                      ? "bg-zinc-900 border-zinc-800 text-zinc-450 hover:bg-zinc-850 hover:text-zinc-200"
                                      : "bg-violet-600/10 hover:bg-violet-600/20 border-violet-500/20 text-violet-400"
                                  }`}
                                  title={isAdmin ? "Demote to User" : "Promote to Admin"}
                                >
                                  {isAdmin ? "Demote" : "Make Admin"}
                                </button>
                              )}

                              {/* Delete Account (Superadmin Only, or Admin can delete Standard User) */}
                              {!isSelf && (currentUser?.role === "superadmin" || (currentUser?.role === "admin" && !isAdmin && !isSuperadmin)) && (
                                <button
                                  onClick={() => handleDeleteUser(item.id, item.username)}
                                  className="p-1.5 rounded-lg bg-red-650/10 hover:bg-red-600/20 border border-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                  title="Delete Account & Data"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

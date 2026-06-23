"use client";

import React, { useState } from "react";
import { User, Lock, Check, Loader2, Save, Key, Shield, Mail, Calendar, Palette, Settings } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_color: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

interface SettingsPanelProps {
  user: UserProfile;
  refreshProfile: () => Promise<void>;
  showToast: (msg: string, type: "success" | "warning" | "info") => void;
}

const PRESET_COLORS = [
  "#6366f1", "#10b981", "#ef4444", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
  "#14b8a6", "#3b82f6",
];

export default function SettingsPanel({ user, refreshProfile, showToast }: SettingsPanelProps) {
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [avatarColor, setAvatarColor] = useState(user.avatar_color || "#6366f1");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Display name cannot be empty.", "warning");
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          avatar_color: avatarColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      await refreshProfile();
      showToast("Profile settings updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Error updating profile settings.", "warning");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast("Current password is required to set a new password.", "warning");
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters.", "warning");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("New passwords do not match.", "warning");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      showToast("Password updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Error changing password.", "warning");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 select-none animate-fade-in pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-zinc-900 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
          ⚙️ Account Settings
        </h2>
        <p className="text-xs text-zinc-500">
          Manage your CineTrack account profile, passwords, and color preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-6 flex flex-col items-center text-center shadow-lg relative overflow-hidden group">
            <div 
              className="absolute -top-24 w-40 h-40 rounded-full filter blur-[50px] opacity-15 pointer-events-none transition-all duration-500 group-hover:scale-110"
              style={{ backgroundColor: avatarColor }}
            />

            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl relative z-10 select-none border border-white/10"
              style={{ backgroundColor: avatarColor }}
            >
              {(displayName || user.username || "Me").slice(0, 2).toUpperCase()}
            </div>

            <h3 className="text-base font-black text-white mt-4 tracking-tight leading-none">
              {displayName || user.username}
            </h3>
            <p className="text-xs text-indigo-400 font-bold mt-1.5">@{user.username}</p>

            <div className="w-full border-t border-zinc-850/60 mt-6 pt-5 flex flex-col gap-3.5 text-left text-xs">
              <div className="flex items-center gap-2.5 text-zinc-400">
                <Mail className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                <span className="truncate" title={user.email}>{user.email}</span>
              </div>

              <div className="flex items-center gap-2.5 text-zinc-400">
                <Shield className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="capitalize font-bold text-zinc-300">{user.role}</span>
                  {user.is_verified ? (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 animate-pulse">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-zinc-400">
                <Calendar className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                <span>Joined {formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings Forms */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Section 1: Profile Customization */}
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-3xl p-6 shadow-md">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-350 mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Customize Profile</span>
            </h3>

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-650 transition-all outline-none font-medium"
                  placeholder="Enter display name"
                  maxLength={50}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Avatar Color Theme</span>
                </label>
                <div className="flex flex-wrap gap-2.5 mt-1">
                  {PRESET_COLORS.map((color) => {
                    const isSelected = avatarColor.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAvatarColor(color)}
                        className="w-8 h-8 rounded-xl cursor-pointer transition-all duration-200 relative flex items-center justify-center border border-white/5 active:scale-90 hover:scale-105"
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-black/35 flex items-center justify-center backdrop-blur-[1px]">
                            <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={avatarColor}
                    onChange={(e) => setAvatarColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-zinc-850 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={avatarColor.toUpperCase()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("#") && val.length <= 7) setAvatarColor(val);
                    }}
                    className="w-24 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-[10px] text-white font-mono uppercase transition-all outline-none"
                    placeholder="#FFFFFF"
                    maxLength={7}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="self-end mt-2 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 duration-200"
              >
                {isSavingProfile ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Saving...</span></>
                ) : (
                  <><Save className="w-3.5 h-3.5" /><span>Save Changes</span></>
                )}
              </button>
            </form>
          </div>

          {/* Section 2: Password */}
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-3xl p-6 shadow-md">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-350 mb-5 flex items-center gap-2">
              <Lock className="w-4 h-4 text-violet-400" />
              <span>Change Password</span>
            </h3>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 transition-all outline-none"
                  placeholder="••••••••"
                  required={newPassword.length > 0}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 transition-all outline-none"
                    placeholder="Min 6 characters"
                    required={currentPassword.length > 0}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 transition-all outline-none"
                    placeholder="••••••••"
                    required={newPassword.length > 0}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPassword}
                className="self-end mt-2 flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-850 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 duration-200"
              >
                {isSavingPassword ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Updating Password...</span></>
                ) : (
                  <><Key className="w-3.5 h-3.5" /><span>Update Password</span></>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

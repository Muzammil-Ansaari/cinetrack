"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Check,
  X,
  Loader2,
  Bell,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Profile } from "@/lib/supabase";

function AvatarBubble({ profile, size = "md" }: { profile: Profile; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  const initials = (profile.display_name || profile.username)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-extrabold text-white flex-shrink-0`}
      style={{ backgroundColor: profile.avatar_color || "#6366f1" }}
    >
      {initials}
    </div>
  );
}
export default function FriendsPanel() {
  const {
    profile,
    friends,
    friendships,
    pendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    requestMergeLists,
    acceptMergeLists,
    rejectMergeLists,
  } = useAuth();

  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");

  const handleSendRequest = async () => {
    if (!addUsername.trim()) return;
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    const { error } = await sendFriendRequest(addUsername.trim());
    if (error) {
      setAddError(error);
    } else {
      setAddSuccess(`Friend request sent to @${addUsername.trim()}!`);
      setAddUsername("");
    }
    setAddLoading(false);
  };

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(id);
  };

  const handleReject = async (id: string) => {
    await rejectFriendRequest(id);
  };

  const handleRemove = async (friendId: string) => {
    setRemovingId(friendId);
    await removeFriend(friendId);
    setRemovingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add Friend */}
      <div className="p-4 border-b border-zinc-800/60">
        <h3 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-indigo-400" /> Add Friend
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            <input
              type="text"
              placeholder="@username"
              value={addUsername}
              onChange={(e) => {
                setAddUsername(e.target.value.replace("@", ""));
                setAddError(null);
                setAddSuccess(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendRequest(); }}
              className="w-full pl-7 pr-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-lg text-[11px] text-zinc-200 placeholder:text-zinc-600 transition-all font-medium"
            />
          </div>
          <button
            onClick={handleSendRequest}
            disabled={addLoading || !addUsername.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 active:scale-95"
          >
            {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          </button>
        </div>
        {addError && (
          <p className="text-[10px] text-red-400 mt-1.5 px-1 font-semibold animate-fade-in">⚠ {addError}</p>
        )}
        {addSuccess && (
          <p className="text-[10px] text-emerald-400 mt-1.5 px-1 font-semibold animate-fade-in">✓ {addSuccess}</p>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex px-4 pt-3 gap-1">
        <button
          onClick={() => setActiveTab("friends")}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "friends"
              ? "bg-zinc-800 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Users className="w-3 h-3 inline mr-1" />
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer relative ${
            activeTab === "requests"
              ? "bg-zinc-800 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Bell className="w-3 h-3 inline mr-1" />
          Requests
          {pendingRequests.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {activeTab === "friends" && (
          <>
            {friends.length === 0 ? (
              <div className="py-10 text-center select-none">
                <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-500">No friends yet</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Add friends by their @username to co-watch movies!
                </p>
              </div>
            ) : (
              friends.map((friend) => {
                const fsRecord = friendships.find(
                  (fs) => fs.requester_id === friend.id || fs.addressee_id === friend.id
                );
                return (
                  <div
                    key={friend.id}
                    className="flex flex-col gap-2.5 p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-zinc-800 transition-all select-none"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble profile={friend} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-zinc-200 truncate">{friend.display_name}</p>
                        <p className="text-[9px] text-zinc-500 font-medium">@{friend.username}</p>
                      </div>
                      <button
                        onClick={() => handleRemove(friend.id)}
                        disabled={removingId === friend.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all cursor-pointer"
                        title="Remove friend"
                      >
                        {removingId === friend.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <UserX className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>

                    {/* Shared Library Integration Section */}
                    <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[9px]">
                      <span className="font-bold text-zinc-400">Library Sharing:</span>

                      {fsRecord && (
                        <>
                          {fsRecord.merge_status === "accepted" && (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold tracking-wide">
                                🔗 Shared
                              </span>
                              <button
                                onClick={() => rejectMergeLists(friend.id)}
                                className="text-zinc-500 hover:text-red-400 font-extrabold cursor-pointer transition-all hover:underline"
                              >
                                Stop
                              </button>
                            </div>
                          )}

                          {fsRecord.merge_status === "pending" && (
                            <>
                              {fsRecord.merge_requester_id === profile?.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500 italic">Requested...</span>
                                  <button
                                    onClick={() => rejectMergeLists(friend.id)}
                                    className="text-red-400/80 hover:text-red-450 font-bold cursor-pointer transition-all hover:underline"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => acceptMergeLists(friend.id)}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[8px] cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => rejectMergeLists(friend.id)}
                                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 font-bold rounded text-[8px] cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {(fsRecord.merge_status === "none" || !fsRecord.merge_status) && (
                            <button
                              onClick={() => requestMergeLists(friend.id)}
                              className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded font-bold transition-all cursor-pointer"
                            >
                              Share Lists
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === "requests" && (
          <>
            {pendingRequests.length === 0 ? (
              <div className="py-10 text-center select-none">
                <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-500">No pending requests</p>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-2.5 bg-zinc-900/50 border border-indigo-500/10 rounded-xl"
                >
                  {req.requester && <AvatarBubble profile={req.requester as Profile} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-200 truncate">
                      {(req.requester as Profile)?.display_name}
                    </p>
                    <p className="text-[9px] text-zinc-500">@{(req.requester as Profile)?.username} wants to be friends</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                      title="Accept"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                      title="Decline"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { AvatarBubble };

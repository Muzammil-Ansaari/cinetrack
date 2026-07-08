"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, User, Sparkles, Loader2, Search, ArrowRight } from "lucide-react";
import { Movie } from "@/types";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  movies: Movie[];
  onSearchMovie: (title: string) => void;
}

export default function AIChatPanel({ isOpen, onClose, movies, onSearchMovie }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Hello! I am CineTrack AI, your personal movie assistant. I have analyzed your library and watch history.\n\nAsk me history queries (e.g., *'What did I watch yesterday?'*) or ask for recommendations, and I will prioritize suggesting titles from your unwatched watchlist!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: trimmed,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const chatHistory = messages.concat(userMsg).map((msg) => ({
        sender: msg.sender,
        text: msg.text
      }));

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          movies
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to communicate with AI");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "ai",
          text: data.reply,
          timestamp: new Date()
        }
      ]);
    } catch (e: any) {
      console.error("AI chat assistant error:", e);
      setErrorMsg(e.message || "Something went wrong. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse movie names inside **bold text** to create search tags
  const extractMovieSuggestions = (text: string): string[] => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const matches: string[] = [];
    let match;
    while ((match = boldRegex.exec(text)) !== null) {
      const val = match[1].trim();
      // Only include strings that look like movie names (avoid short words/phrases)
      if (val && val.length > 1 && !val.includes(":") && !val.includes("\n")) {
        matches.push(val);
      }
    }
    return Array.from(new Set(matches)); // unique suggestions
  };

  const quickPrompts = [
    { text: "What did I watch yesterday?", icon: "📅" },
    { text: "Suggest a movie from my watchlist", icon: "🍿" },
    { text: "Recommend a horror show to re-watch", icon: "🎬" },
    { text: "What did I watch last week?", icon: "📜" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all animate-fade-in select-none">
      {/* Sliding Glass Drawer */}
      <div
        ref={panelRef}
        className="w-full max-w-md h-full bg-zinc-950/95 border-l border-zinc-900 shadow-2xl flex flex-col justify-between backdrop-blur-xl relative animate-slide-in"
      >
        {/* Header Section */}
        <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 leading-none">
                CineTrack AI
              </h2>
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mt-1 block">
                Assistant Online
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Screen */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {messages.map((msg) => {
            const suggestions = msg.sender === "ai" ? extractMovieSuggestions(msg.text) : [];
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border text-xs font-bold ${
                    msg.sender === "user"
                      ? "bg-zinc-900 border-zinc-800 text-zinc-300"
                      : "bg-indigo-950/40 border-indigo-900/50 text-indigo-400"
                  }`}
                >
                  {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Bubble Content */}
                <div className="flex flex-col gap-1.5">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                        : "bg-zinc-900/60 border border-zinc-900 text-zinc-300 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Render Movie Suggestion Search Chips */}
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1 select-none">
                      {suggestions.map((title) => (
                        <button
                          key={title}
                          onClick={() => {
                            onSearchMovie(title);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-indigo-500/10 border border-zinc-850 hover:border-indigo-500/35 text-[10px] font-bold text-zinc-400 hover:text-indigo-400 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
                        >
                          <Search className="w-3 h-3" />
                          <span>Search &ldquo;{title}&rdquo;</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[85%] self-start animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="px-4 py-3 bg-zinc-900/60 border border-zinc-900 text-zinc-500 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-[11px] font-semibold text-red-400 select-text leading-relaxed mt-2">
              ⚠️ {errorMsg}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input & suggestions */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950 select-none">
          {/* Quick Reply suggestion chips (only when chat is idle) */}
          {!loading && messages.length <= 2 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.text}
                  onClick={() => handleSend(qp.text)}
                  className="px-3 py-2 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-850/80 hover:border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-zinc-300 rounded-xl transition-all active:scale-95 text-left flex items-start gap-2 cursor-pointer shadow-sm"
                >
                  <span className="text-xs">{qp.icon}</span>
                  <span className="line-clamp-2 leading-tight">{qp.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input text box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CineTrack AI anything..."
              className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-850 focus:border-indigo-500 rounded-xl text-zinc-150 text-xs font-semibold focus:outline-none transition-all shadow-inner placeholder:text-zinc-650"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:border-zinc-850 text-white disabled:text-zinc-600 rounded-xl border border-indigo-500 disabled:border-none cursor-pointer transition-all active:scale-95 shadow-md shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

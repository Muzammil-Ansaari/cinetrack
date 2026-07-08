import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Network fetch timeout utility
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env.local file to use the AI chat." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { messages, movies } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request payload: messages array is required" }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Build user movies context for the AI prompt
    const userMoviesList = Array.isArray(movies) ? movies : [];
    
    const unwatched = userMoviesList.filter((m: any) => !m.watched && !m.watching && !m.declined);
    const watched = userMoviesList.filter((m: any) => m.watched);
    const watching = userMoviesList.filter((m: any) => m.watching);
    const declined = userMoviesList.filter((m: any) => m.declined);

    console.log(`[AI ROUTE DEBUG] Total received: ${userMoviesList.length} | Watched: ${watched.length} | Unwatched: ${unwatched.length} | Watching: ${watching.length} | Declined: ${declined.length}`);

    // Sort watched by watched_at or created_at descending
    watched.sort((a: any, b: any) => {
      const timeA = a.watched_at 
        ? new Date(a.watched_at).getTime() 
        : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const timeB = b.watched_at 
        ? new Date(b.watched_at).getTime() 
        : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return timeB - timeA;
    });

    // Sort unwatched by created_at descending
    unwatched.sort((a: any, b: any) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    const formatMovie = (m: any, includeWatchedDate = false) => {
      const parts = [`"${m.title}" (${m.category}${m.genres ? ` - ${m.genres}` : ""})`];
      if (includeWatchedDate && m.watched_at) {
        parts.push(`Watched: ${m.watched_at.split("T")[0]}`);
      } else if (!m.watched && m.created_at) {
        parts.push(`Added: ${m.created_at.split("T")[0]}`);
      }
      if (m.rating) parts.push(`Rating: ${m.rating}/5`);
      if (m.review) parts.push(`Review: "${m.review}"`);
      return `- ${parts.join(", ")}`;
    };

    const contextParts = [];
    if (watching.length > 0) {
      contextParts.push(`Currently Watching:\n${watching.map(m => formatMovie(m)).join("\n")}`);
    }
    if (unwatched.length > 0) {
      contextParts.push(`Unwatched Watchlist (Recommend from here by default):\n${unwatched.map(m => formatMovie(m)).join("\n")}`);
    }
    if (watched.length > 0) {
      contextParts.push(`Watched History:\n${watched.map(m => formatMovie(m, true)).join("\n")}`);
    }
    if (declined.length > 0) {
      contextParts.push(`Declined Titles (DO NOT recommend these):\n${declined.map((m: any) => `"${m.title}"`).join(", ")}`);
    }

    const movieContext = contextParts.join("\n\n");

    const systemPrompt = `You are CineTrack AI, a helpful and premium movie tracking assistant. You help users navigate their watch history, review their watchlist, and discover new things to watch.

Today's Date: ${todayStr} (Yesterday was ${yesterdayStr})

Here is the user's complete movie library context:
${movieContext || "(The user's list is empty)"}

Strict Guidelines:
1. Answer history-related questions (e.g. "What did I watch yesterday?") by checking the "Watched At" dates of movies.
2. By default, when recommending movies/shows, you MUST recommend from the user's "Unwatched Watchlist" only. Match their genres/mood.
3. If the user explicitly asks to recommend from their watched movies (e.g. "re-watch", "recommend something I've already watched"), you may recommend from their "Watched" list.
4. If they explicitly request external recommendations (not in their library), you can suggest new titles, but make sure they are NOT already in their library (neither Watched nor Declined).
5. Always keep responses clear, concise, friendly, and formatted nicely with markdown.
6. Make movie recommendations stand out by formatting them like: **Title** (Category: genres).`;

    // Map conversation messages to Gemini's format
    const contents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    // Securely call the Gemini API with generous timeout
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents
        })
      },
      55000 // Generous 55-second timeout boundary for local LLM inference
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", errText);
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error("[AI API ERROR]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to communicate with the Gemini AI service." },
      { status: 500 }
    );
  }
}

# CineTrack | Premium Cinematic Tracker

CineTrack is a simple, sleek, and modern full-stack movie tracking application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL)**, featuring live discovery integrations powered by **The Movie Database (TMDB) API**.

---

## ✨ Features

- **Live Movie Lookup**: Search millions of titles online with debounced searches directly hitting the server-safe TMDB API.
- **Cinematic Featured Carousel**: Auto-fetches daily trending movies on load and showcases them in a gorgeous glass backdrop.
- **Cinema Analytics Hub**: Sums up the exact runtimes of your watched movies into cumulative **Cinema Hours** alongside progress metrics.
- **Twin Logging Columns**:
  - **Unwatched Queue**: Log upcoming titles you want to watch.
  - **Watched Collection**: Save completed titles, set a **5-star glowing rating**, and write **auto-saving personal thought logs**.
- **Graceful Fallback Status**: If you don't connect a Supabase database right away, the app seamlessly runs in **Local Mode** using `localStorage` and automatically upgrades to **Cloud Sync Mode** once database environment variables are added!

---

## 🚀 Getting Started

### 1. Run the Development Server
Navigate into the project folder in your terminal and run:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser to view the application.

---

## 💾 2. Supabase Setup (Cloud Database)

To persist your tracked movies securely in the cloud (so you don't lose data on cache clear, and can access it on any mobile device):

1. Create a free account at [Supabase](https://supabase.com/).
2. Create a new project.
3. Open the **SQL Editor** tab in your Supabase dashboard and click **New Query**.
4. Paste the following SQL script and click **Run** (this creates the `movies` table instantly):

```sql
-- Create the movies table
create table public.movies (
  id uuid not null default gen_random_uuid(),
  tmdb_id text not null,
  title text not null,
  poster_path text null,
  backdrop_path text null,
  release_year text null,
  runtime integer not null default 0,
  synopsis text null,
  watched boolean not null default false,
  rating integer null,
  review text null,
  seasons integer null,
  category text not null default 'Movie',
  created_at timestamp with time zone not null default now(),
  constraint movies_pkey primary key (id),
  constraint movies_tmdb_id_key unique (tmdb_id)
);

-- Enable full read/write permissions for public access
-- (Since we're using the Anon public API client)
alter table public.movies enable row level security;

create policy "Allow public read access" 
  on public.movies for select 
  using (true);

create policy "Allow public insert" 
  on public.movies for insert 
  with check (true);

create policy "Allow public update" 
  on public.movies for update 
  using (true);

create policy "Allow public delete" 
  on public.movies for delete 
  using (true);
```

---

## 🔑 3. Environment Variables Configuration

Open the `.env.local` file inside the root of your project folder. Fill in your Supabase API keys (found in Supabase under **Project Settings -> API**):

```env
# Your pre-loaded valid TMDB API developer key
TMDB_API_KEY=46b64310f8c3347203f4780bbac0144d

# Copy these from your Supabase Project Settings -> API Settings dashboard:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Restart your terminal server after modifying `.env.local` to apply the keys!

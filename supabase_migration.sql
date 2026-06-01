-- ============================================================
-- CineTrack Multi-User Schema Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. USER PROFILES TABLE
-- Stores public profile info for each authenticated user
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text not null default '',
  avatar_color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Anyone can read profiles (needed for friend search)
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);


-- 2. FRIENDSHIPS TABLE
-- Tracks friend requests and accepted friendships between users
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  merge_status text not null default 'none' check (merge_status in ('none', 'pending', 'accepted')),
  merge_requester_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- Enable RLS
alter table public.friendships enable row level security;

-- Users can see friendships they are involved in
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can create friend requests
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- Users can update (accept/reject or request/accept merge) requests they are involved in
create policy "Users can update own friendships"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can delete friendships they are part of
create policy "Users can remove friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);


-- 3. ADD user_id TO MOVIES TABLE
-- Link each movie to the user who added it
alter table public.movies
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists watched_by text default '',
  add column if not exists ratings_json text default '{}',
  add column if not exists reviews_json text default '{}',
  add column if not exists global_rating numeric null,
  add column if not exists genres text null;

-- FIX: Drop the old global unique constraint on tmdb_id
-- (multiple users should be able to add the same movie to their own lists)
alter table public.movies
  drop constraint if exists movies_tmdb_id_key;

-- Add a per-user composite unique constraint instead
-- (one user can't add the same TMDB title twice, but different users can)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movies_tmdb_id_user_id_key'
  ) then
    alter table public.movies
      add constraint movies_tmdb_id_user_id_key unique (tmdb_id, user_id);
  end if;
end $$;

-- Enable RLS on movies (if not already)
alter table public.movies enable row level security;

-- Drop any old open policies first (idempotent-safe)
drop policy if exists "Enable all for authenticated users" on public.movies;
drop policy if exists "Users can view own movies" on public.movies;
drop policy if exists "Users can insert own movies" on public.movies;
drop policy if exists "Users can update own movies" on public.movies;
drop policy if exists "Users can delete own movies" on public.movies;

-- Users can view their own movies OR movies belonging to accepted friends
create policy "Users can view own and friends movies"
  on public.movies for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = movies.user_id)
          or (addressee_id = auth.uid() and requester_id = movies.user_id)
        )
    )
  );

create policy "Users can insert own movies"
  on public.movies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own movies"
  on public.movies for update
  using (auth.uid() = user_id);

create policy "Users can delete own movies"
  on public.movies for delete
  using (auth.uid() = user_id);


-- 4. AUTO-CREATE PROFILE ON SIGNUP (optional trigger)
-- This creates a minimal profile when a new user signs up
-- The app code also does this but this acts as a safety net
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. ENABLE SUPABASE REALTIME
-- Enables instantaneous collaborative syncing across friends without reloading
alter publication supabase_realtime add table public.movies;

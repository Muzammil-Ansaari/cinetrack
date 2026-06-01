import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Detect if Supabase is properly configured
export const isSupabaseConfigured =
  supabaseUrl.trim() !== '' &&
  supabaseAnonKey.trim() !== '';

// Initialize client (fallback silently to null if credentials aren't supplied yet)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Type helpers
export type SupabaseUser = {
  id: string;
  email?: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  merge_status?: 'none' | 'pending' | 'accepted';
  merge_requester_id?: string | null;
  created_at: string;
  // joined profile data
  requester?: Profile;
  addressee?: Profile;
};

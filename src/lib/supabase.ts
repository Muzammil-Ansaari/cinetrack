// Supabase has been deprecated in favor of native MongoDB auth.
// This file is kept only for backwards compatibility of types and references.

export const isSupabaseConfigured = false;
export const supabase = null;

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
  role?: string;
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

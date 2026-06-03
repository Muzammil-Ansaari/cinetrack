export interface Movie {
  id: string;
  tmdb_id: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: string | null;
  runtime: number; // in minutes
  synopsis: string | null;
  watched: boolean;
  declined?: boolean;
  rating: number | null; // 1-5 stars (personal rating)
  review: string | null; // Personal notes
  seasons: number | null; // Number of seasons (for TV Shows / Anime Series)
  episodes?: number | null; // Total episodes (for TV Shows / Anime Series)
  category: string; // Movie, TV Show, Anime, Animated Movie
  global_rating: number | null; // TMDB average rating (e.g., 8.7)
  genres: string | null; // Comma-separated list of genres (e.g., "Crime, Drama")
  watched_by?: string;
  declined_by?: string;
  ratings_json?: string;
  reviews_json?: string;
  user_id?: string | null;
  created_at?: string;
  release_date?: string | null;
}

export interface TMDBMovie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  vote_average?: number;
  overview?: string;
  runtime?: number;
  media_type?: string;
  seasons?: number | null;
  episodes?: number | null;
  number_of_episodes?: number | null;
  category?: string;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
  genres?: { id: number; name: string }[];
}

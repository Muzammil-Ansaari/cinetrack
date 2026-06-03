import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// Helper to get the MongoDB database and collection
async function getCollection() {
  const client = await clientPromise;
  const db = client.db("cinetrack");
  return db.collection("movies");
}

// 1. GET: Fetch movies for a user or a list of users (for co-watching / friends merge)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const migrate = searchParams.get("migrate");

    if (migrate === "true") {
      const collection = await getCollection();

      // Backfill owners field for any records that are missing it
      await collection.updateMany(
        { owners: { $exists: false } },
        [{ $set: { owners: { $ifNull: ["$reviews_json", ""] } } }]
      );

      const movies = await collection.find({
        $or: [
          { release_date: { $exists: false } },
          { release_date: null },
          { release_date: "" }
        ]
      }).toArray();

      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      if (!TMDB_API_KEY) {
        return NextResponse.json({ error: "Server TMDB key missing" }, { status: 500 });
      }

      const updated = [];
      for (const movie of movies) {
        if (!movie.release_date) {
          try {
            const isTv = movie.category === "TV Show" || movie.category === "Anime";
            const mediaType = isTv ? "tv" : "movie";
            const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movie.tmdb_id}?api_key=${TMDB_API_KEY}&language=en-US`);
            if (res.ok) {
              const data = await res.json();
              const releaseDate = data.release_date || data.first_air_date || null;
              if (releaseDate) {
                await collection.updateOne(
                  { _id: movie._id },
                  { $set: { release_date: releaseDate } }
                );
                updated.push({ title: movie.title, release_date: releaseDate });
              }
            }
          } catch (err: any) {
            console.error(`Failed migrating release_date for ${movie.title}:`, err);
          }
        }
      }
      return NextResponse.json({ success: true, migrated: updated });
    }

    const userIdsStr = searchParams.get("userIds");

    if (!userIdsStr) {
      return NextResponse.json({ error: "userIds query parameter is required" }, { status: 400 });
    }

    const userIds = userIdsStr.split(",").map(id => id.trim()).filter(Boolean);
    const collection = await getCollection();
    
    // Fetch all movies added by any of the specified users, sorting by created_at descending
    const movies = await collection
      .find({ user_id: { $in: userIds } })
      .sort({ created_at: -1 })
      .toArray();

    // MongoDB returns _id as an ObjectId or string. Let's make sure the client gets the standard id string
    const formattedMovies = movies.map((m: any) => {
      const { _id, ...rest } = m;
      return {
        ...rest,
        // Preserve standard id string
        id: rest.id || String(_id)
      };
    });

    return NextResponse.json({ results: formattedMovies });
  } catch (error: any) {
    console.error("[MONGODB GET MOVIES ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to fetch movies from MongoDB" }, { status: 500 });
  }
}

// 2. POST: Add or bulk import movies (supports both single and bulk arrays)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const collection = await getCollection();

    const moviesToInsert = Array.isArray(body) ? body : [body];

    if (moviesToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const operations = moviesToInsert.map((movie: any) => {
      // Ensure we clean the MongoDB internal _id to prevent duplicate key errors if upserting
      const { _id, ...cleanMovie } = movie;

      // Ensure owners field is always set — default to reviews_json (original adder) if missing
      if (!cleanMovie.owners && cleanMovie.reviews_json) {
        cleanMovie.owners = cleanMovie.reviews_json;
      }
      
      return {
        updateOne: {
          filter: { tmdb_id: cleanMovie.tmdb_id, user_id: cleanMovie.user_id },
          update: { $set: cleanMovie },
          upsert: true
        }
      };
    });

    const result = await collection.bulkWrite(operations);

    return NextResponse.json({ 
      success: true, 
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      count: moviesToInsert.length
    });
  } catch (error: any) {
    console.error("[MONGODB POST MOVIES ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to save movies to MongoDB" }, { status: 500 });
  }
}

// 3. PUT: Update a movie (for toggle watched, edit ratings/reviews, etc.)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id"); // Standard ID field
    const tmdbId = searchParams.get("tmdb_id");
    const userId = searchParams.get("user_id");

    const updateFields = await request.json();
    const collection = await getCollection();

    let filter: any = {};
    if (id) {
      filter = { id: id };
    } else if (tmdbId && userId) {
      filter = { tmdb_id: tmdbId, user_id: userId };
    } else {
      return NextResponse.json({ error: "Must supply 'id' or both 'tmdb_id' and 'user_id' to update" }, { status: 400 });
    }

    // Clean internal field update to avoid accidentally updating system values
    delete updateFields._id;
    delete updateFields.id;

    const result = await collection.updateOne(filter, { $set: updateFields });

    return NextResponse.json({ 
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error: any) {
    console.error("[MONGODB PUT MOVIE ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update movie in MongoDB" }, { status: 500 });
  }
}

// 4. DELETE: Delete a movie entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const tmdbId = searchParams.get("tmdb_id");
    const userId = searchParams.get("user_id");

    const collection = await getCollection();

    let filter: any = {};
    if (id) {
      filter = { id: id };
    } else if (tmdbId && userId) {
      filter = { tmdb_id: tmdbId, user_id: userId };
    } else if (userId) {
      filter = { user_id: userId };
    } else {
      return NextResponse.json({ error: "Must supply 'id', 'user_id', or both 'tmdb_id' and 'user_id' to delete" }, { status: 400 });
    }

    const result = await collection.deleteMany(filter);

    return NextResponse.json({ 
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error("[MONGODB DELETE MOVIE ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to delete movie from MongoDB" }, { status: 500 });
  }
}

const { MongoClient } = require('mongodb');

// URI from .env.local
const uri = "mongodb+srv://muzammilansaari6:QrHfuvfgioxt1Lgy@cluster0.mpfnzvi.mongodb.net/";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("cinetrack");

    console.log("Connected to MongoDB database 'cinetrack'. Starting purge...");

    // Delete from movies
    const moviesResult = await db.collection("movies").deleteMany({
      title: { $regex: /one piece/i }
    });
    console.log(`Successfully deleted ${moviesResult.deletedCount} movies/shows matching "One Piece".`);

    // Delete from activities
    const collections = await db.listCollections().toArray();
    const hasActivities = collections.some(c => c.name === "activities");
    if (hasActivities) {
      const activitiesResult = await db.collection("activities").deleteMany({
        $or: [
          { movieTitle: { $regex: /one piece/i } },
          { message: { $regex: /one piece/i } }
        ]
      });
      console.log(`Successfully deleted ${activitiesResult.deletedCount} activity records matching "One Piece".`);
    } else {
      console.log("No 'activities' collection found to purge.");
    }

  } catch (error) {
    console.error("Purging error:", error);
  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

run().catch(console.error);

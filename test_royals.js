const TMDB_API_KEY = "46b64310f8c3347203f4780bbac0144d";

async function test() {
  try {
    const query = "The Royals";
    const res = await fetch(`https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`);
    const data = await res.json();
    console.log("--- MULTI SEARCH RESULTS FOR THE ROYALS ---");
    const tvItems = data.results.filter(item => item.media_type === 'tv');
    for (const item of tvItems) {
      console.log(`ID: ${item.id}, Name: ${item.name || item.title}, Language: ${item.original_language}, Date: ${item.first_air_date}`);
      const tvRes = await fetch(`https://api.tmdb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}`);
      if (tvRes.ok) {
        const tvData = await tvRes.json();
        console.log(`  -> Number of seasons: ${tvData.number_of_seasons}`);
        console.log(`  -> Seasons list:`, tvData.seasons.map(s => `${s.name} (${s.season_number}): ${s.episode_count} eps`));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();

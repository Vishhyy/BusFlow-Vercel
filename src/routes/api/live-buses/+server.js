// src/routes/api/live-buses/+server.js
import { json } from '@sveltejs/kit';

const TRANSITLIVE_API_URL = 'https://transitlive.com/json/updatedBuses.js';

export async function GET({ setHeaders }) {
    try {
        const response = await fetch(TRANSITLIVE_API_URL, {
            headers: {
                // Add any headers TransitLive.com might require, if any.
                // For example, sometimes a User-Agent is good practice.
                'User-Agent': 'BusFlowApp/1.0 (https://busflow.vercel.app)',
            }
        });

        if (!response.ok) {
            // If TransitLive returns an error, pass it through or handle it
            console.error(`Error fetching from TransitLive: ${response.status} ${response.statusText}`);
            // You might want to return the error status and body from TransitLive
            const errorBody = await response.text().catch(() => 'Could not read error body');
            return json({ error: `Failed to fetch data from upstream API: ${response.status}`, details: errorBody }, { status: response.status });
        }

        const data = await response.json();

        // --- Optional: Cache Control ---
        // Tell browsers/Vercel Edge Network to cache the response for a short period
        // to reduce load on transitlive.com and improve response times for your users.
        // Adjust max-age (seconds) and s-maxage (seconds, for shared caches like Vercel's Edge)
        // For live data, keep this short (e.g., 5-10 seconds).
        setHeaders({
            'Cache-Control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=10'
            // 'public': Allows shared caches (like Vercel's Edge) to cache it.
            // 'max-age=5': Client browsers cache for 5 seconds.
            // 's-maxage=5': Vercel's Edge cache for 5 seconds.
            // 'stale-while-revalidate=10': If cached data is older than 5s but younger than 15s (5+10),
            //                                serve the stale data immediately while revalidating in the background.
        });

        return json(data);

    } catch (error) {
        console.error('Error in /api/live-buses serverless function:', error);
        return json({ error: 'Internal Server Error fetching live bus data' }, { status: 500 });
    }
}

// Optional: Handle OPTIONS requests for preflight CORS checks if you were to call this
// from a *different* domain than busflow.vercel.app (not needed for same-project usage).
// export async function OPTIONS() {
//   return new Response(null, {
//     headers: {
//       'Access-Control-Allow-Origin': 'https://busflow.vercel.app', // Or '*'
//       'Access-Control-Allow-Methods': 'GET',
//       'Access-Control-Allow-Headers': 'Content-Type',
//     }
//   });
// }
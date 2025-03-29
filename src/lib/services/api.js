// URLs from your environment variables or directly defined
const LIVE_BUS_API_URL = import.meta.env.VITE_API_URL;
const TIMING_API_BASE_URL = 'https://stark-headland-53423-ad8df5faf2c9.herokuapp.com/api/bus-timings'; // Your old API

/**
 * Fetches live bus positions.
 * Handles potential CORS issues and validates response.
 */
export async function fetchLiveBusPositions() {
    try {
        console.log("📡 Fetching live bus data...");
        // IMPORTANT: The 'no-cors' mode PREVENTS reading the response.
        // Your API endpoint (VITE_API_URL) MUST send correct CORS headers
        // (Access-Control-Allow-Origin: *) or be proxied through your backend.
        // Remove 'mode: no-cors' if CORS is configured correctly.
        const response = await fetch(LIVE_BUS_API_URL /*, { mode: 'cors' } */); // Try without no-cors first

        // Handle cases where the API might return empty response or non-JSON
         if (response.status === 204) { // No Content
             console.warn("⚠️ Live bus API returned No Content (204).");
            return [];
         }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch live bus data`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             console.warn(`⚠️ Unexpected content-type: ${contentType}. Trying to parse as JSON anyway.`);
             // throw new Error(`Expected JSON, got ${contentType}`);
        }

        const data = await response.json();
        console.log(`✅ Received ${Array.isArray(data) ? data.length : 'non-array'} bus updates.`);

        // Basic validation
        if (!Array.isArray(data)) {
            console.error("❌ Expected an array from live bus API, received:", data);
            return [];
        }
        return data;

    } catch (error) {
        console.error("❌ Error fetching live bus positions:", error);
        // Return empty array or throw error depending on how you want to handle failures
        return [];
    }
}


// --- Functions for the older/unimplemented Timing API ---

/**
 * Fetches available route IDs for a specific stop from the old API.
 */
export async function fetchAvailableRoutesForStop(stopId) {
    if (!stopId) return [];
    console.log(`🔍 Fetching routes for stop: ${stopId}`);
    // Increase limit significantly to get all routes for the stop
    const apiUrl = `${TIMING_API_BASE_URL}?stop=${stopId}&routes=all&lim=100&skip=0&ws=0`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        // Extract unique route IDs
        const uniqueRoutes = [...new Set(data.map(bus => bus.route_id))];
         console.log(`✅ Found routes for stop ${stopId}:`, uniqueRoutes);
        return uniqueRoutes;
    } catch (error) {
        console.error(`❌ Error fetching available routes for stop ${stopId}:`, error);
        return []; // Return empty array on error
    }
}

/**
 * Fetches predicted bus times for a specific stop and route from the old API.
 */
export async function fetchBusTimesForStopRoute(stopId, routeId) {
    if (!stopId || !routeId) return [];
    console.log(`🛠 Fetching bus times for Stop ID: ${stopId}, Route ID: ${routeId}`);
    const apiUrl = `${TIMING_API_BASE_URL}?stop=${stopId}&routes=${routeId}&lim=3&skip=0&ws=0`;
    try {
        const response = await fetch(apiUrl);
         if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        console.log(`✅ Bus times for Stop ${stopId}, Route ${routeId}:`, data);
        return data; // Returns array of timing objects or empty array
    } catch (error) {
        console.error(`❌ Error fetching bus times for stop ${stopId}, route ${routeId}:`, error);
        return []; // Return empty array on error
    }
}
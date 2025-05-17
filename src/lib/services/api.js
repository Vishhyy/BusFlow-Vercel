// URLs from your environment variables or directly defined
const LIVE_BUS_API_URL = import.meta.env.VITE_API_URL;
const STOP_TIMES_PROXY_BASE_URL = '/api/stop-times'; 

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


// --- MODIFIED/NEW Functions for Stop Times using transitlive.com proxy ---

/**
 * Fetches predicted bus times for a specific stop using the new API.
 * The new API seems to give times for all routes at that stop.
 * @param {string} stopId
 * @returns {Promise<Array|Object|null>} Parsed JSON data from the API or null on error.
 *                                      The structure depends on the actual API response.
 */
export async function fetchTimesForStop(stopId) {
    if (!stopId) {
        console.error("fetchTimesForStop: stopId is required.");
        return null; // Or throw error
    }
    const apiUrl = `${STOP_TIMES_PROXY_BASE_URL}?stop=${encodeURIComponent(stopId)}`;
    console.log(`API Service: Fetching stop times from proxy: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
            console.error(`API Service: Error fetching stop times for stop ${stopId} from proxy. Status: ${response.status}`, errorData);
            throw new Error(`HTTP error ${response.status} from stop times proxy: ${errorData.details || errorData.error}`);
        }
        const data = await response.json();
        // console.log(`API Service: Successfully fetched stop times for ${stopId}:`, data);

        // IMPORTANT: You MUST inspect the 'data' structure here.
        // If transitlive.com returned HTML via your proxy (because it was the original format),
        // data might be { htmlContent: "<html>..." }.
        // If it returned JSON directly, data will be that JSON.
        // You need to adapt StopPopup.svelte to handle this structure.
        return data;

    } catch (error) {
        console.error(`API Service: Exception fetching/parsing stop times for stop ${stopId}:`, error);
        return null; // Return null or re-throw to be handled by caller
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
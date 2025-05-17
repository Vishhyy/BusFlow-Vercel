// src/routes/api/stop-times/+server.js
import { json } from '@sveltejs/kit';

const TRANSITLIVE_STOP_TIMES_BASE_URL = 'https://transitlive.com/ajax/livemap.php';

export async function GET({ url, setHeaders }) {
    const stopId = url.searchParams.get('stop');
    if (!stopId) return json({ error: 'Missing stop ID parameter' }, { status: 400 });

    const targetUrl = `${TRANSITLIVE_STOP_TIMES_BASE_URL}?action=stop_times&stop=${encodeURIComponent(stopId)}`;
    console.log(`[API /api/stop-times] Proxying to: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'BusFlowApp/1.0 (YourDeployedSite)',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
            }
        });

        const contentType = response.headers.get("content-type");
        console.log(`[API /api/stop-times] Received Content-Type from TransitLive: '${contentType}' for stop ${stopId}`);
        const responseText = await response.text();

        if (!response.ok) {
            console.error(`[API /api/stop-times] Error from TransitLive for stop ${stopId}: ${response.status} ${response.statusText}. Body: ${responseText.substring(0,500)}`);
            return json({ error: `Upstream API failed: ${response.status}`, details: responseText, requestedStopId: stopId }, { status: response.status });
        }

        let dataToReturn;

        // --- MODIFIED LOGIC ---
        // Try to parse as JSON first, as we know the content IS JSON text
        try {
            dataToReturn = JSON.parse(responseText);
            console.log(`[API /api/stop-times] Successfully parsed responseText as JSON for stop ${stopId}`);
        } catch (parseError) {
            // If JSON.parse fails, then it truly wasn't valid JSON or was something else
            console.warn(`[API /api/stop-times] Failed to parse responseText as JSON directly for stop ${stopId}. Content-Type was '${contentType}'. Error: ${parseError.message}`);
            console.warn("[API /api/stop-times] Response text was:", responseText.substring(0, 1000));
            // Fallback to wrapping as htmlContent if it's not parsable as JSON,
            // though this scenario should be less likely if transitlive.com is consistent.
            dataToReturn = { htmlContent: responseText, requestedStopId: stopId, parseError: parseError.message };
        }
        // --- END MODIFIED LOGIC ---


        setHeaders({ 'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=20' });
        return json(dataToReturn); // This will now be the actual parsed JSON array (hopefully)

    } catch (error) {
        console.error(`[API /api/stop-times] Network or other error for stop ${stopId}:`, error);
        return json({ error: 'Internal Server Error in proxy', details: error.message, requestedStopId: stopId }, { status: 500 });
    }
}
// function file for live bus times     -> busTimesLoader.js

// async function fetchBusTimes     -> showStopPopup, showRouteSelectionPopup

// Fetches Bus Timings from old API(Expired/Unimplemented) As of March 14, 2025
import { showBusTimesPopup } from "./busStopLoader";

async function fetchBusTimes(stopId, routeId) {
    try {
        console.log(`🛠 Fetching bus times for Stop ID: ${stopId}, Route ID: ${routeId}`);

        if (!stopId || !routeId) {
            console.error('🚨 Missing stopId or routeId!', { stopId, routeId });
            showBusTimesPopup(`<p style="color: red;">Error: Stop ID or Route is missing.</p>`);
            return;
        }

        // ✅ Updated API URL to use routeId instead of routeShortName
        const apiUrl = `https://stark-headland-53423-ad8df5faf2c9.herokuapp.com/api/bus-timings?stop=${stopId}&routes=${routeId}&lim=3&skip=0&ws=0`;
        console.log('📡 API Request:', apiUrl);

        const response = await fetch(apiUrl);
        const textResponse = await response.text(); // Capture raw API response

        if (!response.ok) {
            console.error('🚨 API Error Response:', textResponse);
            throw new Error(`HTTP ${response.status}: ${textResponse}`);
        }

        const data = JSON.parse(textResponse);
        console.log(`✅ Bus times for Stop ${stopId} on Route ${routeId}:`, data);

        if (!data || data.length === 0) {
            return showBusTimesPopup(`<p>No upcoming buses for Route ${routeId}.</p>`);
        }

        let busTimesHtml = data
            .map(
                (bus) => `
            <p><strong>Route ${bus.route_id}</strong> → Arriving at <strong>${bus.pred_time}</strong></p>
        `
            )
            .join('');

        showBusTimesPopup(busTimesHtml);
    } catch (error) {
        console.error('❌ Error fetching bus times:', error);
        showBusTimesPopup(`<p style="color: red;">Failed to load bus times. ${error.message}</p>`);
    }
}

export { fetchBusTimes};
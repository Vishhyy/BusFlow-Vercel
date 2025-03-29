// function file for live bus postions  -> busPosLoader.js

// fetchLiveBusPositions used in -> onMount in GoogleMap.svelte

import { getBusColor, createBusIcon } from "./busIconLoader.js";
import { busMarkers, previousBusPositions } from "./globalVars.js";
import { smoothMoveMarker } from "./animations.js";
import { calculateHeading } from "./calculations.js";

const API_URL = import.meta.env.VITE_API_URL;

// Fetches live bus positions w/ use of API
async function fetchLiveBusPositions(map, busMarkers, google, previousBusData) {
    try {
        console.log("📡 Fetching live bus data from TransitLive...");

        const response = await fetch(API_URL, {
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch data`);

        const data = await response.json();
        console.log("✅ Parsed API Response:", data);

        if (!Array.isArray(data) || data.length === 0) {
            console.warn("⚠️ No live buses found.");
            return;
        }

        // ✅ Check if previousBusData exists and compare with new data
        if (previousBusData && JSON.stringify(previousBusData) === JSON.stringify(data)) {
            console.warn("⚠️ Same bus data received, skipping update.");
            return;
        }

        previousBusData = data; // ✅ Store latest data

        data.forEach(bus => {
            const busId = bus.properties.b;
            const routeId = bus.properties.r;
            const busLine = bus.properties.line;

            // ✅ Extract correct latitude & longitude values
            if (!bus.geometry || !bus.geometry.coordinates || bus.geometry.coordinates.length !== 2) {
                console.error(`❌ Invalid coordinates for Bus ${busId} on Route ${routeId}:`, bus.geometry);
                return;
            }

            const newPosition = {
                lat: parseFloat(bus.geometry.coordinates[1]), // Latitude
                lng: parseFloat(bus.geometry.coordinates[0])  // Longitude
            };

            if (isNaN(newPosition.lat) || isNaN(newPosition.lng)) {
                console.error(`❌ NaN detected in coordinates for Bus ${busId}:`, newPosition);
                return;
            }

            console.log(`🚌 Bus ${busId} on Route ${routeId} →`, newPosition);

            if (busMarkers[busId]) {
                // ✅ Calculate heading using previous position
                const previousPosition = previousBusPositions[busId] || newPosition; // Use new position if first time
                const heading = calculateHeading(previousPosition, newPosition);
                previousBusPositions[busId] = newPosition; // Store new position

                // ✅ Update bus icon with new heading
                const busColor = getBusColor(routeId);
                const updatedIcon = createBusIcon(routeId, busColor, heading);
                busMarkers[busId].content = updatedIcon;

                // ✅ Smoothly move the marker
                smoothMoveMarker(busMarkers[busId], newPosition);

            } else {
                // ✅ First-time marker creation
                const busColor = getBusColor(routeId);
                const heading = calculateHeading(null, newPosition);
                const busIcon = createBusIcon(routeId, busColor, heading);

                const busMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: newPosition,
                    map: map,
                    title: `Bus ${busId} - ${busLine}`,
                    content: busIcon,
                    zIndex: 100,
                });

                busMarkers[busId] = busMarker;
                previousBusPositions[busId] = newPosition;
            }
        });

    } catch (error) {
        console.error("❌ Error fetching live bus positions:", error);
    }
}

export {fetchLiveBusPositions};
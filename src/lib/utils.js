// Color generation, icon creation, heading calculation, smoothing

const routeColors = {};
// Predefined high-contrast, readable colors for bus routes
const highContrastColors = [
    "#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#FFD700", "#FF8C00", "#8A2BE2",
    "#20B2AA", "#DC143C", "#00FA9A", "#FF4500", "#7FFF00", "#1E90FF", "#FF1493",
    "#32CD32", "#9932CC", "#4682B4", "#DAA520", "#FF6347", "#40E0D0"
];

// Assigns a color to a route number, ensuring consistency
export function getBusColor(routeNumber) {
    const routeId = String(routeNumber); // Ensure consistent key type
    if (!routeColors[routeId]) {
        // Use a simple hashing or modulo for color assignment
        let hash = 0;
        for (let i = 0; i < routeId.length; i++) {
            hash = routeId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % highContrastColors.length;
        routeColors[routeId] = highContrastColors[index];
    }
    return routeColors[routeId];
}


/**
 * Creates bus icon canvas element, centered on the canvas (25x25).
 * V7: Arrow position adjusted. Crucially, NO CSS transform. Correct anchoring.
 * @param {number|string} routeNumber
 * @param {string} color
 * @param {number} heading
 * @returns {HTMLCanvasElement}
 */
export function createBusIcon(routeNumber, color, heading) {
    const canvas = document.createElement("canvas");
    const canvasSize = 50;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");

    const centerX = canvasSize / 2; // 25
    const centerY = canvasSize / 2; // 25 - Target visual center

    // --- Rotation Step ---
    ctx.translate(centerX, centerY);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // --- Draw Arrow (Positioned HIGHER relative to center) ---
    ctx.fillStyle = color;
    ctx.beginPath();
    const arrowTipY = centerY - 20; // y=5
    const arrowBaseY = arrowTipY + 10; // y=15
    const arrowWidth = 6;
    ctx.moveTo(centerX, arrowTipY);         // Tip at (25, 5)
    ctx.lineTo(centerX + arrowWidth, arrowBaseY); // Base Right at (31, 15)
    ctx.lineTo(centerX - arrowWidth, arrowBaseY); // Base Left at (19, 15)
    ctx.closePath();
    ctx.fill();

    // --- Reset Transform ---
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // --- Draw Circle and Text (Centered at 25, 25) ---
    const circleRadius = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(routeNumber), centerX, centerY);

    // --- NO CSS TRANSFORM --- <<<<< IMPORTANT >>>>>

    return canvas; // Return the canvas as drawn
}

// Calculates the direction for buses using old n new positions
export function calculateHeading(previousPosition, newPosition) {
    if (!previousPosition || !newPosition || (previousPosition.lat === newPosition.lat && previousPosition.lng === newPosition.lng)) {
        return previousPosition?.heading || 0; // Return previous heading or 0 if no movement
    }

    const lat1 = (previousPosition.lat * Math.PI) / 180;
    const lat2 = (newPosition.lat * Math.PI) / 180;
    const deltaLng = ((newPosition.lng - previousPosition.lng) * Math.PI) / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    let heading = (Math.atan2(y, x) * 180) / Math.PI;
    heading = (heading + 360) % 360; // Normalize to 0-360
    return heading;
}


/**
 * Smoothly animates a Google Maps marker to a new position using requestAnimationFrame.
 * V5: Tries .lat/.lng(), then attempts to access internal UC/VC properties, then fallbacks.
 *
 * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to animate.
 * @param {object} newPosition - The target position { lat, lng }.
 * @param {object} google - The Google Maps API object.
 * @param {number} duration - Animation duration in milliseconds.
 */
export function smoothMoveMarker(marker, newPosition, google, duration = 1500) {

    // --- Prerequisite Checks ---
    if (!marker || !newPosition || !google?.maps?.LatLng) {
        console.warn("smoothMoveMarker V5: EXIT - Missing marker, newPosition, or google.maps.LatLng."); return;
    }
    const targetLat = parseFloat(newPosition.lat); const targetLng = parseFloat(newPosition.lng);
    if (isNaN(targetLat) || isNaN(targetLng)) {
        console.warn("smoothMoveMarker V5: EXIT - Invalid target coords:", newPosition);
        try { if (marker) marker.position = { lat: targetLat, lng: targetLng }; } catch (e) {}
        return;
    }

    // --- Determine Starting Position (V5 Logic) ---
    let startLatLng;
    const currentMarkerPos = marker.position;
    let foundStartMethod = "None";

    // Attempt 1: Use standard .lat() / .lng() methods ...
    if (currentMarkerPos && typeof currentMarkerPos.lat === 'function' /* ... */) {
        // ... logic using methods ...
        foundStartMethod = ".lat()/.lng() methods";
        try { startLatLng = new google.maps.LatLng(currentLat, currentLng); } catch (e) {/*...*/}
   }

   // Attempt 2: Check internal UC/VC properties
   if (!startLatLng && currentMarkerPos && typeof currentMarkerPos === 'object' && currentMarkerPos !== null) {
        const internalLat = currentMarkerPos.UC; const internalLng = currentMarkerPos.VC;
        if (typeof internalLat === 'number' && !isNaN(internalLat) && typeof internalLng === 'number' && !isNaN(internalLng)) {
            // *** CHANGE THIS LINE ***
            // Change console.warn to console.log for less alarming output, or remove entirely
            console.log('[smoothMoveMarker V5.1 START] Using INTERNAL UC/VC properties for start:', { internalLat, internalLng });
            // console.warn was here previously
            // *** END CHANGE ***
            foundStartMethod = "Internal UC/VC"; // Still note how we got it
            try { startLatLng = new google.maps.LatLng(internalLat, internalLng); } catch (e) {/*...*/}
        }
   }

   // Attempt 3: Fallback ...
   if (!startLatLng) {
       foundStartMethod = "Fallback to Target";
        console.warn('[smoothMoveMarker V5.1 START] FALLBACK - Using target as start.'); // Keep this as a WARN
        try { startLatLng = new google.maps.LatLng(targetLat, targetLng); } catch (e) { console.error("smoothMoveMarker V5.1: FATAL - Fallback failed", e); return; }
   } else if (foundStartMethod !== "Fallback to Target") {
        // console.log(`[smoothMoveMarker V5.1 START] Determined start using: ${foundStartMethod}`); // Log success if NOT fallback
   }


    // --- Prepare Target LatLng ---
     let targetLatLng;
     try {
         targetLatLng = new google.maps.LatLng(targetLat, targetLng);
     } catch(e) { console.error("smoothMoveMarker V5: FATAL - Could not create targetLatLng.", e); return; }

    // --- Check if Already at Target ---
    const tolerance = 0.000001;
    if (Math.abs(startLatLng.lat() - targetLatLng.lat()) < tolerance && Math.abs(startLatLng.lng() - targetLatLng.lng()) < tolerance) {
         try { if (marker && (!marker.position || !marker.position.equals(targetLatLng))) { marker.position = targetLatLng; }} catch (e) {}
         return;
    }

    // --- Animation Setup & Loop ---
    if (marker.animationFrameId) { cancelAnimationFrame(marker.animationFrameId); marker.animationFrameId = null; }
    const startTime = performance.now();

    function animateStep(timestamp) {
         if (!marker || !google?.maps?.LatLng) { /* Stop if prerequisites disappear */ marker.animationFrameId=null; return; }

        const elapsed = timestamp - startTime;
        const fraction = Math.min(elapsed / duration, 1);
        const currentLat = startLatLng.lat() + (targetLatLng.lat() - startLatLng.lat()) * fraction;
        const currentLng = startLatLng.lng() + (targetLatLng.lng() - startLatLng.lng()) * fraction;

        if (isNaN(currentLat) || isNaN(currentLng)) { /* Stop on NaN */ try{marker.position=targetLatLng;}catch(e){} marker.animationFrameId=null; return; }

        // Set Position using new LatLng
        try {
             marker.position = new google.maps.LatLng(currentLat, currentLng);
        } catch (e) { /* Stop on error */ console.error("[smoothMoveMarker V5 ANIM_ERR] SetPos:", e); marker.animationFrameId = null; return; }

        // Continue or Finish
        if (fraction < 1) { marker.animationFrameId = requestAnimationFrame(animateStep); }
        else { try { marker.position = targetLatLng; } catch (e) {} marker.animationFrameId = null; }
    }

    // Start animation
    marker.animationFrameId = requestAnimationFrame(animateStep);
} // --- End of smoothMoveMarker V5 ---

// Define dark mode styles for the map
export const darkModeStyles = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3f3f3" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#50596b" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

export const lightModeStyles = []; // Use default Google Maps styles for light mode
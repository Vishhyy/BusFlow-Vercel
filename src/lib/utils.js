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
    if (!marker || !newPosition || !google?.maps?.LatLng) {
        console.warn("smoothMoveMarker V5.2: EXIT - Missing marker, newPosition, or google.maps.LatLng.");
        return;
    }

    const targetLat = parseFloat(newPosition.lat);
    const targetLng = parseFloat(newPosition.lng);
    if (isNaN(targetLat) || isNaN(targetLng)) {
        console.warn("smoothMoveMarker V5.2: EXIT - Invalid target coords:", newPosition);
        try { if (marker) marker.position = { lat: targetLat, lng: targetLng }; } catch (e) { }
        return;
    }

    let startLatLng;
    const currentMarkerPos = marker.position; // Read the .position property

    // --- Attempt to get LatLng from currentMarkerPos ---
    if (currentMarkerPos) {
        if (typeof currentMarkerPos.lat === 'function' && typeof currentMarkerPos.lng === 'function') {
            // It behaves like a LatLng object, try calling methods
            const sLat = currentMarkerPos.lat();
            const sLng = currentMarkerPos.lng();
            if (!isNaN(sLat) && !isNaN(sLng)) {
                console.log('[smoothMoveMarker V5.2 START] Using .lat()/.lng() methods.');
                startLatLng = new google.maps.LatLng(sLat, sLng);
            } else {
                console.warn('[smoothMoveMarker V5.2 START] .lat()/.lng() methods returned NaN.');
            }
        } else if (typeof currentMarkerPos.lat === 'number' && typeof currentMarkerPos.lng === 'number' && !isNaN(currentMarkerPos.lat) && !isNaN(currentMarkerPos.lng)) {
            // It's a LatLngLiteral-like object {lat: number, lng: number}
            console.log('[smoothMoveMarker V5.2 START] Using literal {lat, lng} object.');
            startLatLng = new google.maps.LatLng(currentMarkerPos.lat, currentMarkerPos.lng);
        }
        // Add the UC/VC check as a last resort if the above failed and object exists
        else if (typeof currentMarkerPos === 'object' && currentMarkerPos !== null &&
            typeof currentMarkerPos.UC === 'number' && typeof currentMarkerPos.VC === 'number' &&
            !isNaN(currentMarkerPos.UC) && !isNaN(currentMarkerPos.VC)) {
            console.warn('[smoothMoveMarker V5.2 START] Using INTERNAL UC/VC properties.');
            startLatLng = new google.maps.LatLng(currentMarkerPos.UC, currentMarkerPos.VC);
        } else {
            console.warn('[smoothMoveMarker V5.2 START] marker.position is unrecognized:', currentMarkerPos);
        }
    } else {
        console.warn('[smoothMoveMarker V5.2 START] marker.position is null or undefined.');
    }


    if (!startLatLng) {
        console.warn('[smoothMoveMarker V5.2 START] FALLBACK - Using target as start.');
        startLatLng = new google.maps.LatLng(targetLat, targetLng);
    }

    const targetLatLng = new google.maps.LatLng(targetLat, targetLng);
    const tolerance = 0.000001;
    if (Math.abs(startLatLng.lat() - targetLatLng.lat()) < tolerance && Math.abs(startLatLng.lng() - targetLatLng.lng()) < tolerance) {
        try { if (marker.position !== targetLatLng) marker.position = targetLatLng; } catch (e) { }
        return;
    }

    if (marker.animationFrameId) { cancelAnimationFrame(marker.animationFrameId); marker.animationFrameId = null; }
    const startTime = performance.now();

    function animateStep(timestamp) {
        // ... (rest of animateStep as in V5, ensuring new google.maps.LatLng is used for setting position)
        if (!marker || !google?.maps?.LatLng) { if (marker) marker.animationFrameId = null; return; }
        const elapsed = timestamp - startTime; const fraction = Math.min(elapsed / duration, 1);
        const currentLat = startLatLng.lat() + (targetLatLng.lat() - startLatLng.lat()) * fraction;
        const currentLng = startLatLng.lng() + (targetLatLng.lng() - startLatLng.lng()) * fraction;
        if (isNaN(currentLat) || isNaN(currentLng)) { try { marker.position = targetLatLng; } catch (e) { } marker.animationFrameId = null; return; }
        try { marker.position = new google.maps.LatLng(currentLat, currentLng); }
        catch (e) { console.error("Anim Err SetPos V5.2:", e); marker.animationFrameId = null; return; }
        if (fraction < 1) { marker.animationFrameId = requestAnimationFrame(animateStep); }
        else { try { marker.position = targetLatLng; } catch (e) { } marker.animationFrameId = null; }
    }
    marker.animationFrameId = requestAnimationFrame(animateStep);
}

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
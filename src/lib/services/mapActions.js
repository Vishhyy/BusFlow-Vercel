import { get } from 'svelte/store';
import {
    mapInstance, googleInstance, activeRoutePolylines, gtfsData,
    isMapReady, selectedStop
} from '$lib/stores.js';
import { getBusColor, createBusIcon, calculateHeading, smoothMoveMarker } from '$lib/utils.js';

// --- loadBusStops (viewport aware) ---
let currentStopMarkersMap = new Map(); // Use a Map: { stop_id: AdvancedMarkerElement }
const MIN_ZOOM_TO_RENDER_STOPS = 15;

function createAndAddStopMarker(stop, map, google) {
    const el = document.createElement('div');
    el.style.width = '8px'; el.style.height = '8px'; el.style.backgroundColor = 'rgba(0,100,255,0.8)';
    el.style.borderRadius = '50%'; el.style.border = '1px solid white'; el.title = stop.stop_name;
    const stopMarker = new google.maps.marker.AdvancedMarkerElement({ position: { lat: stop.stop_lat, lng: stop.stop_lon }, map: map, title: stop.stop_name, content: el });
    stopMarker.addListener('click', () => { selectedStop.set({ id: stop.stop_id, lat: stop.stop_lat, lng: stop.stop_lon, name: stop.stop_name }); });
    return stopMarker;
}
export function updateVisibleStops() {
    const map = get(mapInstance); const google = get(googleInstance); const allStops = get(gtfsData)?.stops; const ready = get(isMapReady);
    if (!ready || !map || !google || !allStops || allStops.length === 0) { currentStopMarkersMap.forEach(marker => marker.map = null); currentStopMarkersMap.clear(); return; }
    const currentZoom = map.getZoom();
    if (currentZoom < MIN_ZOOM_TO_RENDER_STOPS) { if (currentStopMarkersMap.size > 0) { currentStopMarkersMap.forEach(marker => marker.map = null); currentStopMarkersMap.clear(); } return; }
    const bounds = map.getBounds(); if (!bounds) { return; }
    const newVisibleStopIds = new Set();
    for (const stop of allStops) {
        if (stop.stop_lat == null || stop.stop_lon == null || isNaN(stop.stop_lat) || isNaN(stop.stop_lon)) continue;
        const stopLatLng = new google.maps.LatLng(stop.stop_lat, stop.stop_lon);
        if (bounds.contains(stopLatLng)) { newVisibleStopIds.add(stop.stop_id); if (!currentStopMarkersMap.has(stop.stop_id)) { const marker = createAndAddStopMarker(stop, map, google); currentStopMarkersMap.set(stop.stop_id, marker); } }
    }
    const markersToRemove = [];
    currentStopMarkersMap.forEach((marker, stopId) => { if (!newVisibleStopIds.has(stopId)) markersToRemove.push(stopId); });
    markersToRemove.forEach(stopId => { const marker = currentStopMarkersMap.get(stopId); if (marker) marker.map = null; currentStopMarkersMap.delete(stopId); });
}

const BUS_MARKER_GRACE_PERIOD_MS = 20000;
let currentBusMarkers = {}; // Cache for marker elements: { busId: AdvancedMarkerElement }
let previousBusData = {};   // Cache for previous position data: { busId: { lat, lng, heading, lastSeen } }

export function updateBusMarkers(liveBuses) {
    const map = get(mapInstance);
    const google = get(googleInstance);
    const ready = get(isMapReady);

    if (!ready || !map || !google || !Array.isArray(liveBuses)) {
        return;
    }

    const now = Date.now();
    const activeBusIds = new Set();

    liveBuses.forEach(bus => {
        const busId = bus.properties?.b?.toString();
        const routeId = bus.properties?.r?.toString();
        if (!busId || !routeId) {
            // console.warn("Skipping bus update due to missing ID or route:", bus.properties);
            return;
        }

        const coords = bus.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length !== 2 || coords.some(c => c == null || isNaN(c))) {
            console.warn(`Invalid coordinates for Bus ${busId}:`, coords);
            return;
        }

        let newPositionLatLng;
        try {
            newPositionLatLng = new google.maps.LatLng(parseFloat(coords[1]), parseFloat(coords[0]));
            if (isNaN(newPositionLatLng.lat()) || isNaN(newPositionLatLng.lng())) throw new Error("LatLng creation resulted in NaN");
        } catch (e) {
            console.error(`Error creating LatLng for newPosition (Bus ${busId}):`, e, coords);
            return;
        }
        const newPositionObj = { lat: newPositionLatLng.lat(), lng: newPositionLatLng.lng() };

        activeBusIds.add(busId);

        const prevData = previousBusData[busId];
        const heading = calculateHeading(prevData, newPositionObj);
        const busColor = getBusColor(routeId);
        const busIconCanvas = createBusIcon(routeId, busColor, heading);

        if (currentBusMarkers[busId]) {
            const marker = currentBusMarkers[busId];
            if (!marker) {
                delete currentBusMarkers[busId];
                delete previousBusData[busId];
                return;
            }
            if (marker.heading !== heading || marker.color !== busColor) {
                try { marker.content = busIconCanvas; } catch (e) { console.error(`Error setting marker content for ${busId}`, e); }
                marker.heading = heading; marker.color = busColor;
            }
            // Add detailed logging here if smoothMoveMarker is still an issue
            smoothMoveMarker(marker, newPositionObj, google);
        } else {
            try {
                const busMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: newPositionLatLng, // Use LatLng instance
                    map: map,
                    title: `Bus ${busId} - Route ${routeId}`,
                    content: busIconCanvas,
                    zIndex: 100, // Make sure this is high enough
                });
                busMarker.heading = heading; busMarker.color = busColor;
                currentBusMarkers[busId] = busMarker;
                // console.log(`➕ Added marker for Bus ${busId}.`);
            } catch (creationError) {
                console.error(`Error creating AdvancedMarkerElement for bus ${busId}:`, creationError);
                return;
            }
        }
        previousBusData[busId] = { ...newPositionObj, heading: heading, lastSeen: now };
    });

    Object.keys(currentBusMarkers).forEach(existingBusId => {
        if (!activeBusIds.has(existingBusId)) {
            const prevData = previousBusData[existingBusId];
            if (prevData?.lastSeen) {
                const timeSinceLastSeen = now - prevData.lastSeen;
                if (timeSinceLastSeen > BUS_MARKER_GRACE_PERIOD_MS) {
                    // console.log(`➖ Removing marker for inactive Bus ${existingBusId}`);
                    const markerToRemove = currentBusMarkers[existingBusId];
                    if (markerToRemove) {
                        try {
                            if (markerToRemove.animationFrameId) cancelAnimationFrame(markerToRemove.animationFrameId);
                            markerToRemove.map = null;
                        } catch (removeError) { console.warn(`Error removing marker ${existingBusId}:`, removeError); }
                    }
                    delete currentBusMarkers[existingBusId];
                    delete previousBusData[existingBusId];
                }
            } else {
                // console.warn(`Removing marker for Bus ${existingBusId} (no prev timestamp).`);
                const markerToRemove = currentBusMarkers[existingBusId];
                if (markerToRemove) try { markerToRemove.map = null; } catch (e) { }
                delete currentBusMarkers[existingBusId];
            }
        }
    });
}

// --- Display Multiple/Single Route Polylines ---
export function displayMultipleRoutes(selectedRouteIds = []) {
    const map = get(mapInstance); const google = get(googleInstance); const currentGtfs = get(gtfsData); const ready = get(isMapReady);
    if (!ready || !map || !google || !currentGtfs?.shapes || !currentGtfs?.routeToShapeMap || !currentGtfs?.routes) {
        const currentPolylinesInStore = get(activeRoutePolylines);
        for (const routeIdKey in currentPolylinesInStore) currentPolylinesInStore[routeIdKey]?.forEach(p => p.setMap(null));
        activeRoutePolylines.set({}); return;
    }
    const currentPolylinesOnMap = get(activeRoutePolylines); const newPolylinesMapForStore = {};
    for (const routeId of selectedRouteIds) {
        const currentRouteIdStr = String(routeId).trim();
        if (currentPolylinesOnMap[currentRouteIdStr]) {
            newPolylinesMapForStore[currentRouteIdStr] = currentPolylinesOnMap[currentRouteIdStr]; newPolylinesMapForStore[currentRouteIdStr].forEach(p => p.setMap(map));
        } else {
            const shapeIds = currentGtfs.routeToShapeMap[currentRouteIdStr];
            if (!shapeIds || shapeIds.length === 0) { console.warn(`No shape IDs for route ${currentRouteIdStr}`); continue; }
            const routeInfo = currentGtfs.routes.find(r => String(r.route_id).trim() === currentRouteIdStr);
            let routeColor = getBusColor(currentRouteIdStr); if (routeInfo?.route_color) routeColor = `#${routeInfo.route_color.replace('#', '')}`;
            const polylinesForThisRoute = [];
            shapeIds.forEach(shapeId => {
                const currentShapeIdStr = String(shapeId).trim(); const shapePoints = currentGtfs.shapes[currentShapeIdStr];
                if (shapePoints && shapePoints.length >= 2) { try { const path = shapePoints.map(p => new google.maps.LatLng(p.lat, p.lng)); const polyline = new google.maps.Polyline({ path, geodesic: true, strokeColor: routeColor, strokeOpacity: 0.8, strokeWeight: 4, map: map, zIndex: 1 }); polylinesForThisRoute.push(polyline); } catch (e) { console.error("Err creating polyline:", e); } }
            });
            if (polylinesForThisRoute.length > 0) newPolylinesMapForStore[currentRouteIdStr] = polylinesForThisRoute;
        }
    }
    for (const existingRouteId in currentPolylinesOnMap) { if (!selectedRouteIds.includes(existingRouteId)) { currentPolylinesOnMap[existingRouteId].forEach(p => p.setMap(null)); } }
    activeRoutePolylines.set(newPolylinesMapForStore);
    // console.log(`Updated routes. Visible: ${Object.keys(newPolylinesMapForStore).join(',')}`);
}
export function displaySingleRoute(newRouteId) {
    if (newRouteId === null || newRouteId === undefined) displayMultipleRoutes([]);
    else displayMultipleRoutes([String(newRouteId).trim()]);
}
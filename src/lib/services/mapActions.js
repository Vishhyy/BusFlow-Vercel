// src/lib/services/mapActions.js
import { get } from 'svelte/store';
import {
    mapInstance, googleInstance, gtfsData, isMapReady, selectedStop, activeRoutePolylines
} from '$lib/stores.js';
import { getBusColor, createBusIcon, calculateHeading, smoothMoveMarker } from '$lib/utils.js';
// Assuming createStopMarkerElement is still relevant or you adapt it
// function createStopMarkerElement(stop) { ... } - (defined as in previous example)

let visibleStopMarkers = new Map(); // Use a Map to store markers by stop_id for efficient add/remove: { stop_id: AdvancedMarkerElement }
const MIN_ZOOM_TO_RENDER_STOPS = 15; // Show stops only at zoom 15 or higher (REALLY CLOSE)

// Helper to create the stop marker (AdvancedMarkerElement)
function createAndAddStopMarker(stop, map, google) {
    // const el = createStopMarkerElement(stop); // Or your preferred way to create content
    const el = document.createElement('div'); // Simple dot example
    el.style.width = '8px'; el.style.height = '8px';
    el.style.backgroundColor = 'rgba(0,100,255,0.8)'; // Blueish
    el.style.borderRadius = '50%'; el.style.border = '1px solid white';
    el.title = stop.stop_name;

    const stopMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: stop.stop_lat, lng: stop.stop_lon },
        map: map,
        title: stop.stop_name,
        content: el,
        // zIndex: 5, // Ensure they are below buses if needed
    });

    stopMarker.addListener('click', () => {
        console.log(`🚏 Stop Marker clicked: ${stop.stop_id}`);
        selectedStop.set({ id: stop.stop_id, lat: stop.stop_lat, lng: stop.stop_lon, name: stop.stop_name });
    });
    return stopMarker;
}


export function updateVisibleStops() {
    const map = get(mapInstance);
    const google = get(googleInstance);
    const allStops = get(gtfsData)?.stops; // Get all stops from the store
    const ready = get(isMapReady);

    if (!ready || !map || !google || !allStops || allStops.length === 0) {
        // Clear any existing markers if prerequisites are not met
        visibleStopMarkers.forEach(marker => marker.map = null);
        visibleStopMarkers.clear();
        // console.warn("updateVisibleStops: Prerequisites not met or no stops to process.");
        return;
    }

    const currentZoom = map.getZoom();

    if (currentZoom < MIN_ZOOM_TO_RENDER_STOPS) {
        // Zoomed out too far, remove all currently visible stop markers
        if (visibleStopMarkers.size > 0) {
            console.log(`Zoom level ${currentZoom} < ${MIN_ZOOM_TO_RENDER_STOPS}. Clearing ${visibleStopMarkers.size} stop markers.`);
            visibleStopMarkers.forEach(marker => marker.map = null);
            visibleStopMarkers.clear();
        }
        return;
    }

    const bounds = map.getBounds();
    if (!bounds) {
        console.warn("updateVisibleStops: Map bounds not available yet.");
        return; // Map might not be fully initialized
    }

    const newVisibleStopIds = new Set(); // IDs of stops that should be visible

    // Filter stops within the current map bounds
    for (const stop of allStops) {
        if (stop.stop_lat == null || stop.stop_lon == null || isNaN(stop.stop_lat) || isNaN(stop.stop_lon)) {
            continue; // Skip invalid stops
        }
        const stopLatLng = new google.maps.LatLng(stop.stop_lat, stop.stop_lon);
        if (bounds.contains(stopLatLng)) {
            newVisibleStopIds.add(stop.stop_id);
            if (!visibleStopMarkers.has(stop.stop_id)) {
                // This stop is in bounds and not currently on map, add it
                const marker = createAndAddStopMarker(stop, map, google);
                visibleStopMarkers.set(stop.stop_id, marker);
            }
        }
    }

    // Remove markers that are no longer in bounds (or became visible by other means)
    const markersToRemove = [];
    visibleStopMarkers.forEach((marker, stopId) => {
        if (!newVisibleStopIds.has(stopId)) {
            markersToRemove.push(stopId);
        }
    });

    markersToRemove.forEach(stopId => {
        const marker = visibleStopMarkers.get(stopId);
        if (marker) marker.map = null; // Remove from map
        visibleStopMarkers.delete(stopId); // Remove from our tracking Map
    });

    // console.log(`Updated visible stops: ${visibleStopMarkers.size} markers now on map.`);
}


// --- Update Bus Markers (Live Data) ---
// Keep your last working version of updateBusMarkers here
const BUS_MARKER_GRACE_PERIOD_MS = 20000;
let currentBusMarkers = {};
let previousBusData = {};
export function updateBusMarkers(liveBuses) { /* ... your full V5 smoothMoveMarker with grace period logic ... */
    const map = get(mapInstance); const google = get(googleInstance); const ready = get(isMapReady);
    if (!ready || !map || !google || !Array.isArray(liveBuses)) { return; }
    const now = Date.now(); const activeBusIds = new Set();
    liveBuses.forEach(bus => {
        const busId = bus.properties?.b?.toString(); const routeId = bus.properties?.r?.toString(); if (!busId || !routeId) return;
        const coords = bus.geometry?.coordinates; if (!Array.isArray(coords) || coords.length !== 2 || coords.some(c => c == null || isNaN(c))) { console.warn(`Invalid coords for Bus ${busId}`); return; }
        const newPosition = { lat: parseFloat(coords[1]), lng: parseFloat(coords[0]) }; activeBusIds.add(busId);
        const prevData = previousBusData[busId]; const heading = calculateHeading(prevData, newPosition);
        const busColor = getBusColor(routeId); const busIconCanvas = createBusIcon(routeId, busColor, heading);
        if (currentBusMarkers[busId]) {
            const marker = currentBusMarkers[busId]; if (!marker) { delete currentBusMarkers[busId]; return; }
            if (marker.heading !== heading || marker.color !== busColor) { try { marker.content = busIconCanvas; } catch (e) { } marker.heading = heading; marker.color = busColor; }
            smoothMoveMarker(marker, newPosition, google);
        } else {
            try { const busMarker = new google.maps.marker.AdvancedMarkerElement({ position: newPosition, map: map, title: `Bus ${busId} - Route ${routeId}`, content: busIconCanvas, zIndex: 100 }); busMarker.heading = heading; busMarker.color = busColor; currentBusMarkers[busId] = busMarker; console.log(`➕ Added marker ${busId}`); } catch (e) { return; }
        }
        previousBusData[busId] = { ...newPosition, heading: heading, lastSeen: now };
    });
    Object.keys(currentBusMarkers).forEach(existingBusId => { if (!activeBusIds.has(existingBusId)) { const prevData = previousBusData[existingBusId]; if (prevData?.lastSeen) { const timeSinceLastSeen = now - prevData.lastSeen; if (timeSinceLastSeen > BUS_MARKER_GRACE_PERIOD_MS) { console.log(`➖ Removing inactive Bus ${existingBusId}`); const markerToRemove = currentBusMarkers[existingBusId]; if (markerToRemove) { try { if (markerToRemove.animationFrameId) cancelAnimationFrame(markerToRemove.animationFrameId); markerToRemove.map = null; } catch (e) { } } delete currentBusMarkers[existingBusId]; delete previousBusData[existingBusId]; } } else { console.warn(`Removing ${existingBusId} missing prev data.`); const markerToRemove = currentBusMarkers[existingBusId]; if (markerToRemove) { try { if (markerToRemove.animationFrameId) cancelAnimationFrame(markerToRemove.animationFrameId); markerToRemove.map = null; } catch (e) { } } delete currentBusMarkers[existingBusId]; } } });
}


// --- NEW/MODIFIED: Display Single Route Polyline ---
export function displaySingleRoute(newRouteId) {
    const map = get(mapInstance);
    const google = get(googleInstance);
    const currentGtfs = get(gtfsData); // Contains routes, shapes, routeToShapeMap
    const ready = get(isMapReady);

    if (!ready || !map || !google || !currentGtfs?.shapes || !currentGtfs?.routeToShapeMap || !currentGtfs?.routes) {
        console.warn("displaySingleRoute: Map not ready or core GTFS data missing.");
        activeRoutePolylines.set({}); // Clear any polylines from store
        return;
    }

    let currentPolylinesInStore = get(activeRoutePolylines);
    const newPolylinesMapForStore = {};

    // 1. Clear all currently displayed polylines from the map
    for (const routeIdKey in currentPolylinesInStore) {
        if (currentPolylinesInStore[routeIdKey]) {
            currentPolylinesInStore[routeIdKey].forEach(polyline => polyline.setMap(null));
        }
    }
    console.log("displaySingleRoute: Cleared existing polylines from map.");

    // 2. If a newRouteId is provided, draw its polylines
    if (newRouteId) {
        const shapeIds = currentGtfs.routeToShapeMap[newRouteId];
        if (!shapeIds || shapeIds.length === 0) {
            console.warn(`No shape IDs found for route ${newRouteId} in routeToShapeMap.`);
            activeRoutePolylines.set({}); // Ensure store is empty
            return;
        }

        // Get route color from GTFS routes data or fallback
        const routeInfo = currentGtfs.routes.find(r => r.route_id === newRouteId);
        let routeColor = getBusColor(newRouteId); // Fallback to utility
        if (routeInfo && routeInfo.route_color) {
            routeColor = `#${routeInfo.route_color.replace('#', '')}`; // Ensure # prefix
        }

        const polylinesToAddForThisRoute = [];

        shapeIds.forEach(shapeId => {
            const shapePoints = currentGtfs.shapes[shapeId];
            if (!shapePoints || shapePoints.length < 2) {
                console.warn(`Not enough points for shape_id ${shapeId} of route ${newRouteId}`);
                return; // continue to next shapeId
            }

            try {
                const path = shapePoints.map(p => new google.maps.LatLng(p.lat, p.lng));
                const polyline = new google.maps.Polyline({
                    path: path,
                    geodesic: true,
                    strokeColor: routeColor,
                    strokeOpacity: 0.9,
                    strokeWeight: 5, // Slightly thicker for visibility
                    map: map,
                    zIndex: 1 // Lower than bus markers
                });
                polylinesToAddForThisRoute.push(polyline);
            } catch (e) {
                console.error(`Error creating polyline for shape_id ${shapeId}:`, e);
            }
        });

        if (polylinesToAddForThisRoute.length > 0) {
            newPolylinesMapForStore[newRouteId] = polylinesToAddForThisRoute;
            console.log(`🗺️ Displaying ${polylinesToAddForThisRoute.length} polyline(s) for route ${newRouteId}`);
        } else {
            console.warn(`No valid polylines could be created for route ${newRouteId}. Shape IDs were: ${shapeIds.join(', ')}`);
        }
    } else {
        console.log("🗺️ Clearing all route polylines (newRouteId is null).");
    }

    activeRoutePolylines.set(newPolylinesMapForStore); // Update the store
}
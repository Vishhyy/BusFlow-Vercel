// src/lib/services/mapActions.js
import { get } from 'svelte/store';
import {
    mapInstance, googleInstance, activeRoutePolylines, gtfsData,
    visibleStopOverlays, selectedStop, isMapReady
} from '$lib/stores.js';
import { getBusColor, createBusIcon, calculateHeading, smoothMoveMarker } from '$lib/utils.js';

// --- (toggleRouteVisibility and loadBusStops remain the same) ---
export function toggleRouteVisibility(routeId) { /* ... as before ... */ }
export function loadBusStops() { /* ... as before ... */ }


// --- Bus Markers (using AdvancedMarkerElement) ---

let currentStopOverlays = []; // Associated with loadBusStops, defined here for clarity
// export function toggleRouteVisibility(routeId) {
//     const map = get(mapInstance); const google = get(googleInstance); const currentGtfs = get(gtfsData); const ready = get(isMapReady);
//     if (!ready || !map || !google || !currentGtfs?.shapes || !currentGtfs?.routeToShapeMap) { console.error("Map not ready..."); return; }
//     const shapeIds = currentGtfs.routeToShapeMap[routeId]; if (!shapeIds) { console.warn(`No shape ID...`); return; }
//     const routeColor = getBusColor(routeId); const currentPolylines = get(activeRoutePolylines); const polylinesInStore = { ...currentPolylines };
//     if (polylinesInStore[routeId]) { /* remove polylines */ polylinesInStore[routeId].forEach(p=>p.setMap(null)); delete polylinesInStore[routeId]; activeRoutePolylines.set(polylinesInStore); console.log(`Removed polylines ${routeId}`);}
//     else { /* add polylines */ const lines = []; shapeIds.forEach(id => {const pts=currentGtfs.shapes[id]; if (!pts || pts.length<2)return; const path=pts.map(p=>new google.maps.LatLng(p.lat, p.lng)); const poly = new google.maps.Polyline({path, geodesic:true, strokeColor:routeColor, strokeOpacity:0.8, strokeWeight:4, map:map, zIndex:1}); lines.push(poly);}); if (lines.length>0){polylinesInStore[routeId]=lines; activeRoutePolylines.set(polylinesInStore); console.log(`Added polylines ${routeId}`);} }
// }
// export function loadBusStops() {
//     const map = get(mapInstance); const google = get(googleInstance); const currentGtfs = get(gtfsData); const ready = get(isMapReady);
//     if (!ready || !map || !google || !currentGtfs?.stops) { console.error("Cannot load stops..."); return; }
//     class StopOverlay extends google.maps.OverlayView { /* ... full class definition as provided before ... */ constructor(stopData, googleInstance, mapInstance){ super(); this.stop = stopData; this.google = googleInstance; this.map = mapInstance; this.div=null; this.clickListener=null; this.setMap(this.map);} onAdd(){ this.div=document.createElement('div'); this.div.className='stop-marker-overlay'; /* styles */; this.clickListener=this.google.maps.event.addDomListener(this.div,'click', (e) => {e.stopPropagation(); console.log(`Stop clicked: ${this.stop.stop_id}`); selectedStop.set({id: this.stop.stop_id, lat: this.stop.stop_lat, lng: this.stop.stop_lon, name: this.stop.stop_name });}); const panes=this.getPanes(); if(panes) panes.overlayMouseTarget.appendChild(this.div); else console.error('no panes');} draw(){ if(!this.map||!this.google||!this.getProjection()||!this.div){if(this.div)this.div.style.display='none'; return;} const projection=this.getProjection(); let position; try{position=projection.fromLatLngToDivPixel(new this.google.maps.LatLng(this.stop.stop_lat,this.stop.stop_lon));}catch(e){this.div.style.display='none';return;} if(!position){this.div.style.display='none';return;} const zoom=this.map.getZoom(); const minZoomToShow=13; if(zoom >= minZoomToShow){const baseSize=4,maxSize=10,zoomFactor=1; let size=Math.min(baseSize+(zoom-minZoomToShow)*zoomFactor, maxSize);size=Math.max(size,1); /* set div styles width/height/left/top/display='block' */}else{this.div.style.display='none';}} onRemove(){ if(this.div){if(this.clickListener){this.google.maps.event.removeListener(this.clickListener);this.clickListener=null;}if(this.div.parentNode)this.div.parentNode.removeChild(this.div);this.div=null;}} remove(){ this.setMap(null);} }
//     console.log(`Updating ${currentGtfs.stops.length} stops...`); currentStopOverlays.forEach(overlay => { try{overlay.remove();}catch(e){console.warn("Err removing ovly:", e)} }); currentStopOverlays = [];
//     currentGtfs.stops.forEach(stop => { if (stop.stop_lat == null || isNaN(parseFloat(stop.stop_lat)) || isNaN(parseFloat(stop.stop_lon))) {console.warn(`Skip stop inv coords ${stop.stop_id}`);return;} try{const overlay=new StopOverlay(stop, google, map);currentStopOverlays.push(overlay);}catch(error){console.error(`Err create StopOvly ${stop.stop_id}`, error);}});
//     console.log(`Loaded ${currentStopOverlays.length} overlays.`); try{google.maps.event.clearListeners(map, 'click'); google.maps.event.addListener(map,'click',()=>{if(get(selectedStop))selectedStop.set(null);});}catch(error){console.error('Err add map click', error);}}
const BUS_MARKER_GRACE_PERIOD_MS = 420000;
let currentBusMarkers = {};
let previousBusData = {};

export function updateBusMarkers(liveBuses) {
    const map = get(mapInstance);
    const google = get(googleInstance);
    const ready = get(isMapReady);

    if (!ready || !map || !google || !Array.isArray(liveBuses)) { return; }

    const now = Date.now();
    const activeBusIds = new Set();

    // --- Process buses from API feed ---
    liveBuses.forEach(bus => {
        let success = false; // Flag to track if this bus was processed fully
        try {
            // --- Extract & Validate ---
            const busId = bus.properties?.b?.toString();
            const routeId = bus.properties?.r?.toString();
            if (!busId || !routeId) throw new Error("Missing busId or routeId"); // Throw to go to catch

            const coords = bus.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length !== 2 || coords.some(c => c == null || isNaN(c))) {
                 throw new Error(`Invalid coordinates: ${JSON.stringify(coords)}`);
            }

            let newPositionLatLng = new google.maps.LatLng(parseFloat(coords[1]), parseFloat(coords[0]));
             if (isNaN(newPositionLatLng.lat()) || isNaN(newPositionLatLng.lng())) {
                 throw new Error("LatLng creation resulted in NaN");
             }
            const newPositionObj = { lat: newPositionLatLng.lat(), lng: newPositionLatLng.lng() };

            activeBusIds.add(busId); // Mark as active now we know coords are good

            const prevData = previousBusData[busId];
            const heading = calculateHeading(prevData, newPositionObj);
            const busColor = getBusColor(routeId);
            const busIconCanvas = createBusIcon(routeId, busColor, heading); // Assumes YOUR preferred version is used

            // --- Update or Create ---
            if (currentBusMarkers[busId]) {
                // --- UPDATE ---
                const marker = currentBusMarkers[busId];
                if (!marker) throw new Error("Marker cache mismatch: Expected marker not found"); // Treat as error

                if (marker.heading !== heading || marker.color !== busColor) {
                   marker.content = busIconCanvas; // Update content first
                   marker.heading = heading; marker.color = busColor; // Store state
                }
                // Call animation
                smoothMoveMarker(marker, newPositionObj, google);

            } else {
                // --- CREATE ---
                const busMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: newPositionLatLng, map: map, title: `Bus ${busId}...`,
                    content: busIconCanvas, zIndex: 100
                });
                busMarker.heading = heading; busMarker.color = busColor;
                currentBusMarkers[busId] = busMarker; // Add to cache only on success
                console.log(`➕ Added marker for Bus ${busId}`);
            }

            // --- Update Previous Data (Only reached on full success) ---
            previousBusData[busId] = { ...newPositionObj, heading: heading, lastSeen: now };
            success = true; // Mark as successful

        } catch (error) {
            // --- Handle Errors During Update/Create ---
            const busIdForError = bus?.properties?.b?.toString() || 'UNKNOWN'; // Try to get ID for log
            console.error(`❌ Error processing bus ${busIdForError}:`, error);
             // **Ensure inconsistent state is cleaned up**
             if (busIdForError !== 'UNKNOWN') {
                 const markerToRemove = currentBusMarkers[busIdForError];
                 if (markerToRemove) { // If marker *was* somehow added before error
                     try { if(markerToRemove.animationFrameId)cancelAnimationFrame(markerToRemove.animationFrameId); markerToRemove.map = null;} catch (e) {}
                 }
                 delete currentBusMarkers[busIdForError]; // Remove from marker cache
                 delete previousBusData[busIdForError]; // Remove from data cache
             }
             // Continue to the next bus in the forEach loop
        }

        // Log timestamp update outside try/catch if needed for debugging success case
        // if(success) console.log(`[Timestamp Update] Bus ${bus?.properties?.b?.toString()} lastSeen set`);

    }); // --- End of liveBuses.forEach loop ---


    // --- Remove Inactive Markers (Grace Period Check) ---
    Object.keys(currentBusMarkers).forEach(existingBusId => {
        if (!activeBusIds.has(existingBusId)) { // Check buses NOT in the current feed
            const prevData = previousBusData[existingBusId];
            const nowForCheck = Date.now();

            // RE-ENABLE THE DETAILED LOGGING for diagnosis if needed
            console.log(`[Grace Check] Bus ID: ${existingBusId}`, { hasPreviousData: !!prevData, previousDataTimestamp: prevData?.lastSeen, currentTime: nowForCheck });

            // *** THE CORE GRACE PERIOD LOGIC ***
            if (prevData?.lastSeen) {
                const timeSinceLastSeen = nowForCheck - prevData.lastSeen;
                 console.log(`[Grace Check Values] Bus ID: ${existingBusId}`, { timeSinceLastSeen, gracePeriod: BUS_MARKER_GRACE_PERIOD_MS });

                if (timeSinceLastSeen > BUS_MARKER_GRACE_PERIOD_MS) {
                    // Grace EXCEEDED - Remove
                    console.log(`➖ Removing ${existingBusId} (idle ${Math.round(timeSinceLastSeen/1000)}s - EXCEEDED)`);
                    const markerToRemove = currentBusMarkers[existingBusId];
                    if (markerToRemove) { try { if(markerToRemove.animationFrameId)cancelAnimationFrame(markerToRemove.animationFrameId); markerToRemove.map = null; } catch(e){} }
                    delete currentBusMarkers[existingBusId];
                    delete previousBusData[existingBusId]; // Delete from both caches
                } else {
                    // Within grace - Keep
                    console.log(`[Grace Check Keep] Bus ${existingBusId} (idle ${Math.round(timeSinceLastSeen/1000)}s < ${BUS_MARKER_GRACE_PERIOD_MS/1000}s)`);
                }
            } else {
                 // *** Inconsistent State: Marker exists, but NO lastSeen data! ***
                 // This *should* be less likely now due to the try/catch cleanup above.
                 // We remove defensively here because we can't apply grace period.
                 console.warn(`[Grace Check Remove] Removing ${existingBusId} due to MISSING prevData/lastSeen (inconsistent state).`);
                 const markerToRemove = currentBusMarkers[existingBusId];
                 if (markerToRemove) { try{if(markerToRemove.animationFrameId)cancelAnimationFrame(markerToRemove.animationFrameId);markerToRemove.map=null;}catch(e){} }
                 delete currentBusMarkers[existingBusId];
                 delete previousBusData[existingBusId]; // Ensure deletion from both caches even if prevData was incomplete/missing
            }
        }
    }); // --- End of inactive marker check loop ---

} // --- End of updateBusMarkers Function ---
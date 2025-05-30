<script>
    import { onDestroy, tick } from 'svelte';
    import { get } from 'svelte/store';
    import { selectedStop, mapInstance, googleInstance, gtfsData, activeRoutePolylines } from '$lib/stores.js'; // gtfsData needed for route mapping
    import { fetchTimesForStop } from '$lib/services/api.js';
    import { displaySingleRoute } from '$lib/services/mapActions.js';
    import { getBusColor } from '$lib/utils.js';

    let popupElement;
    let servingRouteShortNames = []; // Stores short names like "3", "4" from stop times API
    let allPredictionsForStop = [];  // Full list of time predictions for the current stop
    let isLoadingTimes = false;
    let errorMsg = null;
    let googleOverlay = null;
    let previousSelectedStopIdForDebug = null;

    let filteredRouteShortName = null;   // The short name ("3") if user clicks a badge
    let actualRouteIdForDisplay = null; // The full GTFS route_id ("3-43") to pass for polyline

    // Reactive derivation for displayable times
    $: displayableTimes = (() => {
        if (!allPredictionsForStop || allPredictionsForStop.length === 0) return [];
        if (filteredRouteShortName !== null) {
            return allPredictionsForStop
                .filter(item => String(item.route_id) === String(filteredRouteShortName))
                .map(item => ({
                    route: item.route_id, time: item.pred_time,
                    headsign: item.line_name, stop_time_id: item.stop_time_id
                })).slice(0, 5);
        }
        return allPredictionsForStop
            .map(item => ({
                route: item.route_id, time: item.pred_time,
                headsign: item.line_name, stop_time_id: item.stop_time_id
            })).slice(0, 5);
    })();

    function createOverlay(stopData, element) {
        const currentMap = get(mapInstance); const currentGoogle = get(googleInstance);
        if (!currentGoogle || !currentMap || !element) { return null; }
        class StopPopupOverlay extends currentGoogle.maps.OverlayView {
            constructor(stop, popupEl) { super(); this.stopData = stop; this.element = popupEl; this.map = currentMap; this.google = currentGoogle; this.setMap(this.map); }
            onAdd() { const panes = this.getPanes(); if (panes?.overlayMouseTarget) panes.overlayMouseTarget.appendChild(this.element); else console.error("StopPopup: Could not get map panes.");}
            draw() {
                if (!this.map || !this.google || !this.getProjection() || !this.element || !this.stopData) { if(this.element) this.element.style.visibility = 'hidden'; return; }
                const projection = this.getProjection(); let position;
                try { position = projection.fromLatLngToDivPixel(new this.google.maps.LatLng(this.stopData.lat, this.stopData.lng)); }
                catch (e) { if(this.element) this.element.style.visibility = 'hidden'; return; }
                if (position && this.element) { const popupHeight = this.element.offsetHeight; this.element.style.left = `${position.x + 15}px`; this.element.style.top = `${position.y - popupHeight / 2}px`; this.element.style.visibility = 'visible';
                } else { if(this.element) this.element.style.visibility = 'hidden'; }
            }
            onRemove() { if (this.element?.parentNode) this.element.parentNode.removeChild(this.element); }
            remove() { this.setMap(null); }
        }
        return new StopPopupOverlay(stopData, element);
    }

    $: { // Main Reactive Block
        const currentSelectedStopId = $selectedStop ? $selectedStop.id : null;
        // console.log(`StopPopup [REACTIVE ENTRY]: Current $selectedStop.id = ${currentSelectedStopId}, Prev = ${previousSelectedStopIdForDebug}`);

        if ($selectedStop && popupElement) {
            const shouldFetch = currentSelectedStopId !== previousSelectedStopIdForDebug ||
                               (currentSelectedStopId === previousSelectedStopIdForDebug && allPredictionsForStop.length === 0 && !isLoadingTimes && !errorMsg);
            if (shouldFetch) {
                previousSelectedStopIdForDebug = currentSelectedStopId;
                errorMsg = null; allPredictionsForStop = []; servingRouteShortNames = [];
                filteredRouteShortName = null; actualRouteIdForDisplay = null;
                isLoadingTimes = true;
                fetchTimesForStop($selectedStop.id)
                    .then(apiResponseData => {
                        if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) {
                            if (apiResponseData && Array.isArray(apiResponseData)) {
                                allPredictionsForStop = apiResponseData;
                                if (apiResponseData.length > 0) {
                                    const uniqueApiRouteIds = [...new Set(apiResponseData.map(item => String(item.route_id)))];
                                    servingRouteShortNames = uniqueApiRouteIds.sort((a,b) => (parseInt(a,10)||a) - (parseInt(b,10)||b) || a.localeCompare(b));
                                }
                                if (allPredictionsForStop.length === 0 && servingRouteShortNames.length === 0) errorMsg = "No route or departure information found.";
                                else if (allPredictionsForStop.length === 0) errorMsg = "No upcoming departures at this time.";
                            } else if (apiResponseData?.htmlContent) { errorMsg = "Times data in HTML format."; }
                            else { errorMsg = "Unexpected data format for stop times."; }
                        }
                    }).catch(err => { if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) errorMsg = `Error: ${err.message}`;
                    }).finally(() => { if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) isLoadingTimes = false; });
            }
            if (!googleOverlay) { googleOverlay = createOverlay($selectedStop, popupElement); }
            else { if (googleOverlay.map !== get(mapInstance) || googleOverlay.stopData?.id !== $selectedStop.id) { googleOverlay.setMap(get(mapInstance)); googleOverlay.stopData = $selectedStop; } googleOverlay.draw(); }
            if(popupElement) popupElement.style.visibility = 'visible';
        } else if (!$selectedStop) {
            previousSelectedStopIdForDebug = null;
            if (googleOverlay) { if (popupElement) popupElement.style.visibility = 'hidden'; googleOverlay.remove(); googleOverlay = null; }
            allPredictionsForStop = []; servingRouteShortNames = []; filteredRouteShortName = null; actualRouteIdForDisplay = null;
            isLoadingTimes = false; errorMsg = null;
        }
    }

    // Inside StopPopup.svelte - handleRouteBadgeClick
function handleRouteBadgeClick(routeShortNameFromBadge) {
    const clickedRouteShortName = String(routeShortNameFromBadge);
    if (filteredRouteShortName === clickedRouteShortName) {
        // ... toggle off ...
        actualRouteIdForDisplay = null;
    } else {
        filteredRouteShortName = clickedRouteShortName;
        const gtfsRoutes = get(gtfsData)?.routes; // Get all routes from the store
        if (gtfsRoutes) {
            // Find the first GTFS route that has a matching route_short_name
            const matchingGtfsRoute = gtfsRoutes.find(
                r => String(r.route_short_name).trim() === clickedRouteShortName
            );
            if (matchingGtfsRoute) {
                actualRouteIdForDisplay = String(matchingGtfsRoute.route_id).trim(); // This is the full ID like "3-43"
                console.log(`StopPopup: Mapped short name '${clickedRouteShortName}' to GTFS route_id '${actualRouteIdForDisplay}'`);
            } else {
                actualRouteIdForDisplay = null;
                console.warn(`StopPopup: No GTFS route found with route_short_name '${clickedRouteShortName}'`);
            }
        } else { /* ... gtfsData.routes not available ... */ }
    }
    displaySingleRoute(actualRouteIdForDisplay); // Pass the full GTFS ID or null
}

    function closePopup() {
        $selectedStop = null;
        displaySingleRoute(null);
        filteredRouteShortName = null; actualRouteIdForDisplay = null;
    }

    onDestroy(() => { if (googleOverlay) { googleOverlay.remove(); googleOverlay = null; } });
</script>

<div bind:this={popupElement} class="stop-popup-container" style="visibility: hidden;">
    {#if $selectedStop}
        <div class="popup-header">
            <div class="stop-title-section">
                <strong title={`Stop ID: ${$selectedStop.id}`}>{$selectedStop.name || `Stop ${$selectedStop.id}`}</strong>
                {#if !isLoadingTimes && servingRouteShortNames.length > 0}
                    <div class="serving-routes">
                        <span class="serving-routes-label">Serves:</span>
                        {#each servingRouteShortNames as routeNum, i (routeNum)}
                            <button
                                class="route-number-badge"
                                class:active={filteredRouteShortName === routeNum}
                                on:click={() => handleRouteBadgeClick(routeNum)}
                                style={filteredRouteShortName === routeNum ? `background-color: ${getBusColor(actualRouteIdForDisplay || routeNum)}; color: white; border-color: ${getBusColor(actualRouteIdForDisplay || routeNum)};` : ''}
                                title={`Show times and route for ${routeNum}`}
                            >
                                {routeNum}
                            </button>
                            {#if i < servingRouteShortNames.length - 1}<span class="route-separator">, </span>{/if}
                        {/each}
                    </div>
                {/if}
            </div>
            <button class="close-button" on:click={closePopup} title="Close">×</button>
        </div>

        <div class="popup-content">
            {#if isLoadingTimes && allPredictionsForStop.length === 0 }
                <p class="loading-message">Loading stop information...</p>
            {:else if displayableTimes.length > 0}
                <div class="times-section">
                    <p class="section-title">
                        {#if filteredRouteShortName}
                            Next Departures for Route {filteredRouteShortName}:
                        {:else}
                            Next Departures (All Routes):
                        {/if}
                    </p>
                    {#each displayableTimes as arrival (arrival.stop_time_id || `${arrival.route}-${arrival.time}-${Math.random()}`)}
                        <p class="time-entry">
                            <span class="route-badge" style="background-color: {getBusColor(String(arrival.route))};">Route {arrival.route}</span>
                            <span class="headsign-info">to {arrival.headsign}</span>
                            <span class="arrival-time">at {arrival.time}</span>
                        </p>
                    {/each}
                </div>
            {:else if errorMsg}
                <p class="error-message">{errorMsg}</p>
            {:else if !isLoadingTimes}
                 <p class="info-message">No upcoming departures listed at this time{#if filteredRouteShortName} for Route {filteredRouteShortName}{/if}.</p>
            {/if}
        </div>
    {/if}
</div>

<style>
    .stop-popup-container {
        position: absolute; background-color: white; border: 1px solid #ccc; border-radius: 8px;
        box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.2); z-index: 1010; width: 280px;
        max-width: calc(100vw - 30px); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 14px;
        color: #333; pointer-events: auto;
    }
    :global(body.dark-mode) .stop-popup-container { background-color: #2d2d2d; color: #e0e0e0; border-color: #444; }

    .popup-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 12px; border-bottom: 1px solid #eee; }
    :global(body.dark-mode) .popup-header { border-color: #444; }

    .stop-title-section { display: flex; flex-direction: column; align-items: flex-start; flex-grow: 1; margin-right: 8px; min-width: 0; }
    .stop-title-section strong { font-weight: bold; white-space: normal; word-break: break-word; line-height: 1.3; margin-bottom: 2px; }

    .serving-routes { font-size: 0.8em; color: #555; margin-top: 2px; line-height: 1.4; display: flex; flex-wrap: wrap; align-items: center; }
    :global(body.dark-mode) .serving-routes { color: #bbb; }
    .serving-routes-label { font-weight: normal; margin-right: 4px; white-space: nowrap; }
    .route-number-badge {
        font-weight: bold; background-color: #e9ecef; color: #495057;
        padding: 2px 6px; border-radius: 4px; margin-right: 0; display: inline-block;
        margin-bottom: 3px; margin-top: 2px; cursor: pointer;
        border: 1px solid transparent; transition: background-color 0.2s, color 0.2s, border-color 0.2s;
    }
    .route-number-badge:hover { background-color: #d1d5db; }
    .route-number-badge.active { /* background-color set by inline style */ color: white !important; border: 1px solid #555; }
    :global(body.dark-mode) .route-number-badge { background-color: #495057; color: #dee2e6; }
    :global(body.dark-mode) .route-number-badge:hover { background-color: #5a6268; }
    :global(body.dark-mode) .route-number-badge.active { border: 1px solid #aaa; }
    .route-separator { margin-right: 4px; display: inline-block; margin-bottom: 2px;}

    .close-button { background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; padding: 0 0 0 4px; line-height: 1; flex-shrink: 0; }
    .close-button:hover { color: #333; }
    :global(body.dark-mode) .close-button { color: #888; }
    :global(body.dark-mode) .close-button:hover { color: #ddd; }

    .popup-content { padding: 10px 12px; max-height: 200px; overflow-y: auto; }
    .section-title { font-weight: bold; margin-bottom: 8px; font-size: 0.95em; color: #444; }
    :global(body.dark-mode) .section-title { color: #ccc; }

    .times-section { margin-top: 0; }
    .time-entry { margin: 0 0 6px 0; padding: 8px; background-color: #f7f7f7; border-radius: 4px; font-size: 0.9em; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
    :global(body.dark-mode) .time-entry { background-color: #3a3a3a; }

    .route-badge { /* For "Route X" in departure list */
        font-weight: bold; padding: 2px 6px; /* background-color set by inline style */
        color: white; border-radius: 3px; font-size: 0.85em; white-space: nowrap;
    }
    .headsign-info { color: #555; flex-grow: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :global(body.dark-mode) .headsign-info { color: #bbb; }
    .arrival-time { font-weight: bold; color: #333; white-space: nowrap; margin-left: auto; }
    :global(body.dark-mode) .arrival-time { color: #eee; }

    .loading-message, .info-message, .error-message { text-align: center; color: #888; padding: 15px 5px; font-style: italic; }
    :global(body.dark-mode) .loading-message, :global(body.dark-mode) .info-message { color: #aaa; }
    .error-message { color: #d9534f; font-style: normal; font-weight: bold; }
    :global(body.dark-mode) .error-message { color: #e74c3c; }
</style>
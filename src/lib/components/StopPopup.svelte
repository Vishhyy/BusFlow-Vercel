<script>
    import { onDestroy, tick, beforeUpdate, afterUpdate } from 'svelte'; // tick might not be strictly needed here now
    import { get } from 'svelte/store';
    import { selectedStop, mapInstance, googleInstance } from '$lib/stores.js';
    import { fetchTimesForStop } from '$lib/services/api.js';

    let popupElement; // Bound to the main popup div
    let displayableTimes = []; // Formatted times for the UI
    let isLoadingTimes = false;
    let errorMsg = null;
    let googleOverlay = null; // Instance of our Google Maps OverlayView

    // --- DEBUGGING: Track previous selectedStop ID to control re-fetching ---
    let previousSelectedStopIdForDebug = null;

    // Function to create the Google Maps OverlayView (same as before)
    function createOverlay(stopData, element) {
        const currentMap = get(mapInstance);
        const currentGoogle = get(googleInstance);
        if (!currentGoogle || !currentMap || !element) { /* ... error log ... */ return null; }

        class StopPopupOverlay extends currentGoogle.maps.OverlayView {
            constructor(stop, popupEl) { super(); this.stopData = stop; this.element = popupEl; this.map = currentMap; this.google = currentGoogle; this.setMap(this.map); }
            onAdd() { const panes = this.getPanes(); if (panes?.overlayMouseTarget) { panes.overlayMouseTarget.appendChild(this.element); } else { console.error("StopPopup: Could not get map panes for overlay."); }}
            draw() {
                if (!this.map || !this.google || !this.getProjection() || !this.element || !this.stopData) { if(this.element) this.element.style.visibility = 'hidden'; return; }
                const projection = this.getProjection(); let position;
                try { position = projection.fromLatLngToDivPixel(new this.google.maps.LatLng(this.stopData.lat, this.stopData.lng)); }
                catch (e) { if(this.element) this.element.style.visibility = 'hidden'; return; }
                if (position) {
                    const popupWidth = this.element.offsetWidth; const popupHeight = this.element.offsetHeight;
                    this.element.style.left = `${position.x + 15}px`;
                    this.element.style.top = `${position.y - popupHeight / 2}px`;
                    this.element.style.visibility = 'visible';
                } else { if(this.element) this.element.style.visibility = 'hidden'; }
            }
            onRemove() { if (this.element?.parentNode) { this.element.parentNode.removeChild(this.element); } }
            remove() { this.setMap(null); }
        }
        return new StopPopupOverlay(stopData, element);
    }

    // Svelte Lifecycle Debugging (optional, can be commented out after debugging)
    // beforeUpdate(() => {
    //     console.log('StopPopup [beforeUpdate]: $selectedStop.id =', $selectedStop ? $selectedStop.id : 'null');
    // });
    // afterUpdate(() => {
    //     console.log('StopPopup [afterUpdate]: $selectedStop.id =', $selectedStop ? $selectedStop.id : 'null', 'popupElement bound?', !!popupElement);
    // });

    // Main Reactive Block: Handles data fetching and overlay visibility
    $: {
        const currentSelectedStopId = $selectedStop ? $selectedStop.id : null;
        // Log entry into this reactive block to see how often it's triggered
        console.log(
            `StopPopup [REACTIVE BLOCK ENTRY]: Current $selectedStop.id = ${currentSelectedStopId}, ` +
            `Previous (for fetch logic) = ${previousSelectedStopIdForDebug}, ` +
            `popupElement bound = ${!!popupElement}`
        );

        if ($selectedStop && popupElement) { // A stop is selected and the popup DOM element is ready
            // Condition to fetch data:
            // 1. The stop ID has actually changed from the last one we fetched for.
            // OR
            // 2. It's the same stop, but we don't have data (displayableTimes is empty),
            //    we are not currently loading, and there's no existing error message.
            //    This handles the initial load for a stop.
            const shouldFetch = currentSelectedStopId !== previousSelectedStopIdForDebug ||
                               (currentSelectedStopId === previousSelectedStopIdForDebug && displayableTimes.length === 0 && !isLoadingTimes && !errorMsg);

            if (shouldFetch) {
                console.log(`StopPopup [FETCHING DATA]: Condition met for stop ${currentSelectedStopId}. Previous was ${previousSelectedStopIdForDebug}.`);
                previousSelectedStopIdForDebug = currentSelectedStopId; // Update tracker

                errorMsg = null;
                displayableTimes = [];
                isLoadingTimes = true;

                fetchTimesForStop($selectedStop.id)
                    .then(apiResponseData => {
                        // Check if the current selected stop is still the one we initiated this fetch for
                        if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) {
                            if (apiResponseData) {
                                if (Array.isArray(apiResponseData)) {
                                    displayableTimes = apiResponseData.map(item => ({
                                        route: item.route_id,
                                        time: item.pred_time,
                                        headsign: item.line_name,
                                        stop_time_id: item.stop_time_id
                                    })).slice(0, 5); // Show top 5 predictions
                                    if (displayableTimes.length === 0) errorMsg = "No upcoming departures found for this stop.";
                                } else if (apiResponseData.htmlContent) {
                                    errorMsg = "Times data is in HTML format and cannot be displayed directly.";
                                } else {
                                    errorMsg = "Unexpected data format for stop times.";
                                }
                            } else {
                                errorMsg = "Failed to load stop times (API returned no data).";
                            }
                        } else {
                            console.log("StopPopup [FETCH COMPLETE - STALE]: Data arrived but selected stop changed. Ignoring.");
                        }
                    })
                    .catch(err => {
                        if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) {
                            console.error("StopPopup: Error in fetchTimesForStop promise chain:", err);
                            errorMsg = `Error loading times: ${err.message}`;
                        }
                    })
                    .finally(() => {
                        if ($selectedStop && $selectedStop.id === previousSelectedStopIdForDebug) {
                            isLoadingTimes = false;
                        }
                    });
            } else {
                console.log(`StopPopup [SKIPPING FETCH]: Not needed for stop ${currentSelectedStopId}.`);
            }

            // Manage Google Maps Overlay
            if (!googleOverlay) {
                googleOverlay = createOverlay($selectedStop, popupElement);
            } else {
                // Ensure overlay is up-to-date if selectedStop or map instance changes
                if (googleOverlay.map !== get(mapInstance) || googleOverlay.stopData?.id !== $selectedStop.id) {
                    googleOverlay.setMap(get(mapInstance));
                    googleOverlay.stopData = $selectedStop;
                }
                googleOverlay.draw(); // Redraw to update position
            }
             if(popupElement) popupElement.style.visibility = 'visible'; // Ensure visible

        } else if (!$selectedStop) { // No stop is selected (popup should be hidden)
            console.log("StopPopup [REACTIVE BLOCK - DESELECTED]: $selectedStop is null. Cleaning up.");
            previousSelectedStopIdForDebug = null; // Reset tracker
            if (googleOverlay) {
                if (popupElement) popupElement.style.visibility = 'hidden';
                googleOverlay.remove();
                googleOverlay = null;
            }
            displayableTimes = [];
            isLoadingTimes = false; // Reset loading state
            errorMsg = null;
        }
    } // End of reactive block $:

    function closePopup() {
        $selectedStop = null; // Triggers the reactive block to hide/cleanup
    }

    onDestroy(() => {
        if (googleOverlay) {
            googleOverlay.remove();
            googleOverlay = null;
        }
        console.log("StopPopup: Destroyed.");
    });
</script>

<!-- HTML Template -->
<div bind:this={popupElement} class="stop-popup-container" style="visibility: hidden;">
    {#if $selectedStop}
        <div class="popup-header">
            <strong title={`Stop ID: ${$selectedStop.id}`}>{$selectedStop.name || `Stop ${$selectedStop.id}`}</strong>
            <button class="close-button" on:click={closePopup} title="Close">×</button>
        </div>
        <div class="popup-content">
            {#if isLoadingTimes}
                <p class="loading-message">Loading upcoming arrivals...</p>
            {:else if displayableTimes.length > 0}
                <div class="times-section">
                    <p class="section-title">Next Departures:</p>
                    {#each displayableTimes as arrival (arrival.stop_time_id || Math.random())}
                        <p class="time-entry">
                            <span class="route-badge">Route {arrival.route}</span>
                            <span class="headsign-info">to {arrival.headsign}</span>
                            <span class="arrival-time">at {arrival.time}</span>
                        </p>
                    {/each}
                </div>
            {:else if errorMsg}
                <p class="error-message">{errorMsg}</p>
            {:else}
                 <p class="info-message">No upcoming departures found for this stop.</p>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Your existing styles for StopPopup.svelte */
    .stop-popup-container { position: absolute; background-color: white; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.2); z-index: 1010; width: 280px; max-width: 90vw; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 14px; color: #333; pointer-events: auto; }
    :global(body.dark-mode) .stop-popup-container { background-color: #2d2d2d; color: #e0e0e0; border-color: #444; }
    .popup-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: bold; }
    :global(body.dark-mode) .popup-header { border-color: #444; }
    .close-button { background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; padding: 0 4px; line-height: 1; }
    .close-button:hover { color: #333; }
    :global(body.dark-mode) .close-button { color: #888; }
    :global(body.dark-mode) .close-button:hover { color: #ddd; }
    .popup-content { padding: 12px; max-height: 200px; overflow-y: auto; }
    .section-title { font-weight: bold; margin-bottom: 8px; font-size: 0.95em; color: #444; }
    :global(body.dark-mode) .section-title { color: #ccc; }
    .times-section { margin-top: 0; }
    .time-entry { margin: 0 0 6px 0; padding: 8px; background-color: #f7f7f7; border-radius: 4px; font-size: 0.9em; display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; }
    :global(body.dark-mode) .time-entry { background-color: #3a3a3a; }
    .route-badge { font-weight: bold; padding: 2px 6px; background-color: #007bff; color: white; border-radius: 3px; font-size: 0.85em; }
    :global(body.dark-mode) .route-badge { background-color: #0056b3; }
    .headsign-info { color: #555; flex-grow: 1; }
    :global(body.dark-mode) .headsign-info { color: #bbb; }
    .arrival-time { font-weight: bold; color: #333; white-space: nowrap; }
    :global(body.dark-mode) .arrival-time { color: #eee; }
    .loading-message, .info-message, .error-message { text-align: center; color: #888; padding: 15px 5px; font-style: italic; }
    :global(body.dark-mode) .loading-message, :global(body.dark-mode) .info-message { color: #aaa; }
    .error-message { color: #d9534f; font-style: normal; font-weight: bold; }
    :global(body.dark-mode) .error-message { color: #e74c3c; }
</style>
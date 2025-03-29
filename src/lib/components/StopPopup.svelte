<script>
    import { onDestroy } from 'svelte';
    import { selectedStop, mapInstance, googleInstance } from '$lib/stores.js';
    import { fetchAvailableRoutesForStop, fetchBusTimesForStopRoute } from '$lib/services/api.js';

    let popupElement; // Bind to the popup div
    let availableRoutes = [];
    let busTimes = null; // null: not loaded, []: loaded, no times, [...]: times data
    let isLoadingRoutes = false;
    let isLoadingTimes = false;
    let errorMsg = null;
    let googleOverlay = null; // Stores the Google Maps OverlayView instance

    // --- OverlayView Logic ---
    function createOverlay(stopData, element) {
        if (!google || !map) return null;

        class StopPopupOverlay extends google.maps.OverlayView {
            constructor(stop, popupEl) {
                super();
                this.stopData = stop;
                this.element = popupEl;
                this.map = map; // Use map from store closure
                this.google = google; // Use google from store closure
                this.setMap(this.map);
            }

            onAdd() {
                 if (!this.element) return;
                const panes = this.getPanes();
                 if (panes) {
                    // floatPane is generally best for popups like this
                    panes.floatPane.appendChild(this.element);
                 }
            }

            draw() {
                 if (!this.map || !this.google || !this.getProjection() || !this.element || !this.stopData) return;

                 const projection = this.getProjection();
                 const position = projection.fromLatLngToDivPixel(
                     new this.google.maps.LatLng(this.stopData.lat, this.stopData.lng)
                 );

                 if (position && this.element.offsetHeight > 0) {
                     // Position slightly above and to the right of the stop marker center
                     const offset = 15; // Pixels offset
                     this.element.style.left = `${position.x + offset}px`;
                     // Adjust vertical position based on popup height to roughly center it vertically nearby
                     this.element.style.top = `${position.y - this.element.offsetHeight / 2 - offset}px`;
                     this.element.style.visibility = 'visible'; // Show it
                 } else {
                     this.element.style.visibility = 'hidden'; // Hide if cannot calculate position
                 }
            }

            onRemove() {
                 if (this.element && this.element.parentNode) {
                     this.element.parentNode.removeChild(this.element);
                 }
            }

            // Helper to remove from map
            remove() {
                this.setMap(null);
            }
        }
        return new StopPopupOverlay(stopData, element);
    }

    // --- Reactive Logic ---
    // React to changes in the selected stop
    $: if ($selectedStop && popupElement) {
        // Stop selected, show popup and fetch data
        console.log('Stop selected:', $selectedStop);
        errorMsg = null; // Clear previous errors
        busTimes = null; // Clear previous times
        availableRoutes = []; // Clear previous routes
        isLoadingRoutes = true;

        // Create/Update Overlay
        if (!googleOverlay) {
            googleOverlay = createOverlay($selectedStop, popupElement);
        } else {
            // If overlay exists, just update its data and redraw if necessary
             googleOverlay.stopData = $selectedStop;
             googleOverlay.draw(); // Trigger redraw
             popupElement.style.visibility = 'visible'; // Make sure it's visible
        }

        fetchAvailableRoutes($selectedStop.id);

    } else if (!$selectedStop && googleOverlay) {
        // Stop deselected, hide popup and remove overlay
        console.log('Stop deselected');
         popupElement.style.visibility = 'hidden'; // Hide element immediately
         // Optionally, wait a frame before removing the overlay if needed for transitions
         // requestAnimationFrame(() => {
             if (googleOverlay) {
                 googleOverlay.remove();
                 googleOverlay = null;
             }
         // });
         // Reset component state
        availableRoutes = [];
        busTimes = null;
        isLoadingRoutes = false;
        isLoadingTimes = false;
        errorMsg = null;
    }

    // --- Data Fetching ---
    async function fetchAvailableRoutes(stopId) {
        isLoadingRoutes = true;
        errorMsg = null;
        try {
            availableRoutes = await fetchAvailableRoutesForStop(stopId);
             if (availableRoutes.length === 0) {
                 console.log(`No routes found for stop ${stopId}.`);
                 // Optionally set a message instead of just empty array
             }
        } catch (err) {
            console.error("Error fetching routes:", err);
            errorMsg = "Could not load routes.";
        } finally {
            isLoadingRoutes = false;
        }
    }

    async function handleRouteClick(routeId) {
        if (!$selectedStop) return;
        isLoadingTimes = true;
        errorMsg = null;
        busTimes = null; // Clear previous times
        try {
            const times = await fetchBusTimesForStopRoute($selectedStop.id, routeId);
            busTimes = times; // Store result (can be empty array)
             if (busTimes.length === 0) {
                 console.log(`No upcoming times found for route ${routeId} at stop ${$selectedStop.id}.`);
             }
        } catch (err) {
            console.error("Error fetching bus times:", err);
            errorMsg = "Could not load bus times.";
        } finally {
            isLoadingTimes = false;
        }
    }

    function closePopup() {
        $selectedStop = null; // Trigger the reactive cleanup
    }

    onDestroy(() => {
        // Ensure overlay is removed if component is destroyed while popup is open
        if (googleOverlay) {
            googleOverlay.remove();
        }
    });

</script>

<!-- Popup Element: Initially hidden, positioned by OverlayView -->
<div bind:this={popupElement} class="stop-popup-container" style="visibility: hidden;">
    {#if $selectedStop}
        <div class="popup-header">
            <strong title={`Stop ID: ${$selectedStop.id}`}>{$selectedStop.name || `Stop ${$selectedStop.id}`}</strong>
            <button class="close-button" on:click={closePopup} title="Close">×</button>
        </div>

        <div class="popup-content">
            {#if isLoadingRoutes}
                <p class="loading-message">Loading routes...</p>
            {:else if availableRoutes.length > 0}
                <div class="routes-section">
                    <p class="section-title">Available Routes:</p>
                    <div class="route-buttons-container">
                        {#each availableRoutes as routeId (routeId)}
                            <button
                                class="route-button"
                                on:click={() => handleRouteClick(routeId)}
                                disabled={isLoadingTimes}
                            >
                                Route {routeId}
                            </button>
                        {/each}
                    </div>
                </div>
            {:else if !errorMsg}
                 <p class="info-message">No routes found for this stop.</p>
            {/if}

            <!-- Bus Times Section -->
            {#if isLoadingTimes}
                 <hr/>
                 <p class="loading-message">Loading times...</p>
            {:else if busTimes && busTimes.length > 0}
                 <hr/>
                 <div class="times-section">
                     <p class="section-title">Upcoming Arrivals:</p>
                     {#each busTimes as bus (bus.trip_id || bus.pred_time + Math.random())} <!-- Ensure unique key -->
                         <p class="time-entry">
                             <strong>Route {bus.route_id}</strong> → {bus.pred_time}
                             {#if bus.headsign}<span class="headsign"> ({bus.headsign})</span>{/if}
                         </p>
                     {/each}
                 </div>
             {:else if busTimes && busTimes.length === 0}
                 <hr/>
                 <p class="info-message">No upcoming arrivals predicted for the selected route.</p>
             {/if}

             <!-- Error Message -->
             {#if errorMsg}
                 <p class="error-message">{errorMsg}</p>
             {/if}
        </div>
    {/if}
</div>


<style>
    .stop-popup-container {
        position: absolute; /* Required for OverlayView */
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1010; /* High z-index */
        width: 260px;
        max-width: 80vw;
        font-family: sans-serif;
        font-size: 14px;
        color: #333;
        /* visibility: hidden; Initially hidden */
        will-change: transform, top, left; /* Perf hint */
        pointer-events: auto; /* Allow clicks inside */
    }
     :global(body.dark-mode) .stop-popup-container {
         background-color: #333;
         color: #eee;
         border-color: #555;
     }

    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
        font-weight: bold;
    }
     :global(body.dark-mode) .popup-header { border-color: #555; }


    .close-button {
        background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; padding: 0 4px;
        :global(body.dark-mode) & { color: #888; }
    }
    .close-button:hover { color: #333; :global(body.dark-mode) & { color: #eee; } }

    .popup-content {
        padding: 12px;
        max-height: 40vh; /* Limit height */
        overflow-y: auto;
    }

    .section-title {
        font-weight: bold;
        margin-bottom: 6px;
        font-size: 13px;
        color: #555;
        :global(body.dark-mode) & { color: #bbb; }
    }

    .route-buttons-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
    }

    .route-button {
        padding: 5px 10px;
        font-size: 12px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    .route-button:hover { background-color: #0056b3; }
    .route-button:disabled { background-color: #aaa; cursor: default; }
     :global(body.dark-mode) .route-button { background-color: #0056b3; }
     :global(body.dark-mode) .route-button:hover { background-color: #004080; }
     :global(body.dark-mode) .route-button:disabled { background-color: #666; }


    hr { margin: 12px 0; border: 0; border-top: 1px solid #eee; :global(body.dark-mode) & { border-color: #555; } }

    .time-entry { margin: 4px 0; }
    .headsign { font-size: 11px; color: #666; :global(body.dark-mode) & { color: #aaa; } }

    .loading-message, .info-message, .error-message {
        text-align: center; color: #888; padding: 10px 0; font-style: italic;
        :global(body.dark-mode) & { color: #aaa; }
    }
    .error-message { color: #d9534f; font-style: normal; :global(body.dark-mode) & { color: #e74c3c; } }

</style>
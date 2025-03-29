<script>
    import { isBusListPopupOpen, gtfsData, activeRoutePolylines } from '$lib/stores.js';
    import { getBusColor } from '$lib/utils.js';
    import { toggleRouteVisibility } from '$lib/services/mapActions.js';

    let routes = [];
    let activeIds = {}; // Local cache for faster lookup

    // Reactively update local routes when GTFS data or popup state changes
    $: if ($gtfsData.routes && $isBusListPopupOpen) {
        routes = $gtfsData.routes
            .map(r => ({
                id: r.route_id,
                name: r.route_short_name || r.route_long_name || `Route ${r.route_id}`, // Use best available name
                color: getBusColor(r.route_id)
            }))
            .sort((a, b) => {
                 // Sort numerically if possible, otherwise alphabetically
                 const numA = parseInt(a.name.match(/\d+/)?.[0] || a.name);
                 const numB = parseInt(b.name.match(/\d+/)?.[0] || b.name);
                 if (!isNaN(numA) && !isNaN(numB)) {
                     return numA - numB;
                 }
                 return a.name.localeCompare(b.name);
            });
    }

    // Reactively update active state based on the polylines store
    $: activeIds = $activeRoutePolylines || {};

    function handleRouteClick(routeId) {
        toggleRouteVisibility(routeId); // Call the action
        // No need to manually update activeIds, the store subscription handles it
    }

</script>

{#if $isBusListPopupOpen}
<div class="bus-list-popup-container">
    <div class="popup-header">
        <strong>Bus Routes</strong>
        <button class="close-button" on:click={() => $isBusListPopupOpen = false} title="Close">×</button>
    </div>
    <div class="popup-content">
        {#if routes.length > 0}
            {#each routes as route (route.id)}
                {@const isActive = !!activeIds[route.id]}
                <button
                    class="route-button"
                    class:active={isActive}
                    style:--route-color={route.color}
                    on:click={() => handleRouteClick(route.id)}
                >
                    <span class="route-icon">🚍</span>
                    <span class="route-name">{route.name}</span>
                     <span class="route-status">{isActive ? 'Visible' : 'Hidden'}</span>
                </button>
            {/each}
        {:else}
            <p class="no-routes-message">No routes loaded.</p>
        {/if}
    </div>
</div>
{/if}

<style>
    .bus-list-popup-container {
        position: absolute;
        bottom: 85px; /* Above control buttons */
        left: 15px;
        width: 240px;
        max-height: 40vh; /* Limit height */
        background-color: white;
        border-radius: 8px;
        box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.25);
        z-index: 1002; /* Above controls */
        display: flex;
        flex-direction: column;
        overflow: hidden; /* Clip content */
        color: #333;
    }
     :global(body.dark-mode) .bus-list-popup-container {
         background-color: #333;
         color: #eee;
         border: 1px solid #555;
     }


    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
        font-weight: bold;
    }
    :global(body.dark-mode) .popup-header {
        border-bottom: 1px solid #555;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #aaa;
        padding: 0 4px;
    }
     :global(body.dark-mode) .close-button {
         color: #888;
     }
    .close-button:hover {
        color: #333;
         :global(body.dark-mode) & { color: #eee; }
    }


    .popup-content {
        padding: 8px;
        overflow-y: auto; /* Enable scrolling */
        flex-grow: 1;
    }

    .route-button {
        display: flex; /* Use flexbox */
        align-items: center;
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 5px;
        border: 1px solid #ddd;
        background-color: #f9f9f9;
        color: #333;
        cursor: pointer;
        border-radius: 5px;
        text-align: left;
        font-size: 14px;
        transition: background-color 0.2s ease, border-color 0.2s ease;
    }
     :global(body.dark-mode) .route-button {
         background-color: #444;
         border-color: #666;
         color: #eee;
     }

    .route-button:hover {
        background-color: #eee;
         border-color: #ccc;
         :global(body.dark-mode) & {
             background-color: #555;
             border-color: #777;
         }
    }

    .route-button.active {
        background-color: var(--route-color, #007bff);
        color: white;
        border-color: var(--route-color, #007bff);
        font-weight: bold;
    }

    .route-icon {
        margin-right: 8px;
    }
    .route-name {
        flex-grow: 1; /* Take available space */
    }
    .route-status {
        font-size: 11px;
        color: #888;
        margin-left: 8px;
    }
     .route-button.active .route-status {
        color: rgba(255, 255, 255, 0.8);
     }
      :global(body.dark-mode) .route-status {
         color: #aaa;
     }

    .no-routes-message {
        text-align: center;
        color: #888;
        padding: 10px;
         :global(body.dark-mode) & { color: #aaa; }
    }

</style>
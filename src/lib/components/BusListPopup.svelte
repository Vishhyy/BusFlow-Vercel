<script>
    import { isBusListPopupOpen, gtfsData, activeRoutePolylines } from '$lib/stores.js';
    import { get } from 'svelte/store';
    import { getBusColor } from '$lib/utils.js';

    export let onRouteSelectionChange; // Expects a function that takes an array of route IDs

    let routes = [];
    let selectedRouteIdsInternal = []; // Internal state for selected IDs in this popup

    // Sync internal selection with global state when popup opens
    function syncSelectedFromStore() {
        const currentActiveMap = get(activeRoutePolylines); // activeRoutePolylines holds { routeId: [polylines] }
        selectedRouteIdsInternal = Object.keys(currentActiveMap);
    }

    $: if ($isBusListPopupOpen) {
        console.log('BusListPopup: $isBusListPopupOpen became true. Processing routes and syncing selection.');
        syncSelectedFromStore();
        if ($gtfsData.routes && $gtfsData.routes.length > 0) {
            routes = $gtfsData.routes.map(r => ({
                id: String(r.route_id).trim(),
                name: r.route_short_name?.trim() || r.route_long_name?.trim() || `Route ${String(r.route_id).trim()}`,
                color: getBusColor(String(r.route_id).trim())
            })).sort((a, b) => {
                const numA = parseInt(a.name.match(/^\d+/)?.[0], 10); const numB = parseInt(b.name.match(/^\d+/)?.[0], 10);
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
                return a.name.localeCompare(b.name);
            });
        }
    }

    function handleRouteToggle(routeId) {
        const idStr = String(routeId);
        const index = selectedRouteIdsInternal.indexOf(idStr);
        if (index > -1) {
            selectedRouteIdsInternal.splice(index, 1);
        } else {
            selectedRouteIdsInternal.push(idStr);
        }
        selectedRouteIdsInternal = [...selectedRouteIdsInternal]; // Trigger Svelte reactivity for the array

        if (onRouteSelectionChange) {
            onRouteSelectionChange([...selectedRouteIdsInternal]); // Pass a new array copy
        }
    }

    function handleClearAll() {
        selectedRouteIdsInternal = [];
        if (onRouteSelectionChange) {
            onRouteSelectionChange([]);
        }
    }
</script>

{#if $isBusListPopupOpen}
<div class="bus-list-popup-container">
    <div class="popup-header">
        <strong>Select Route(s)</strong>
        <button class="close-button" on:click={() => $isBusListPopupOpen = false} title="Close">×</button>
    </div>
    <div class="popup-content">
        <button class="route-button show-all-button" on:click={handleClearAll}> Clear All Selections </button>
        {#if routes.length > 0}
            {#each routes as route (route.id)}
                {@const isActive = selectedRouteIdsInternal.includes(route.id)}
                <button
                    class="route-button"
                    class:active={isActive}
                    style={isActive ? `background-color: ${route.color}; color: white; border-color: ${route.color};` : ''}
                    on:click={() => handleRouteToggle(route.id)}
                    title={`${isActive ? 'Hide' : 'Show'} Route ${route.name}`}
                >
                    <span class="route-icon">🚍</span>
                    <span class="route-name">{route.name}</span>
                    {#if isActive} <span class="route-status-indicator">(Visible)</span> {/if}
                </button>
            {/each}
        {:else if $gtfsData.routes && $gtfsData.routes.length === 0}
            <p class="no-routes-message">No routes available in GTFS data.</p>
        {:else}
            <p class="no-routes-message">Loading routes...</p>
        {/if}
    </div>
</div>
{/if}

<style>
    /* Your existing BusListPopup styles - ensure .route-button.active is styled */
    .bus-list-popup-container { position: absolute; bottom: 85px; left: 15px; width: 250px; max-height: 45vh; background-color: white; border-radius: 8px; box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.25); z-index: 1002; display: flex; flex-direction: column; overflow: hidden; color: #333; }
    :global(body.dark-mode) .bus-list-popup-container { background-color: #333; color: #eee; border: 1px solid #555; }
    .popup-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #eee; font-weight: bold; }
    :global(body.dark-mode) .popup-header { border-bottom-color: #555; }
    .close-button { background: none; border: none; font-size: 22px; cursor: pointer; color: #aaa; padding: 0; line-height: 1; }
    :global(body.dark-mode) .close-button { color: #888; }
    .close-button:hover { color: #333; :global(body.dark-mode) & { color: #eee; } }
    .popup-content { padding: 10px; overflow-y: auto; flex-grow: 1; }
    .route-button { display: flex; align-items: center; width: 100%; padding: 10px; margin-bottom: 6px; border: 1px solid #ddd; background-color: #f9f9f9; color: #333; cursor: pointer; border-radius: 5px; text-align: left; font-size: 14px; transition: background-color 0.2s ease, border-color 0.2s ease; }
    :global(body.dark-mode) .route-button { background-color: #444; border-color: #666; color: #eee; }
    .route-button:hover { background-color: #eee; border-color: #ccc; :global(body.dark-mode) & { background-color: #555; border-color: #777; }}
    .route-button.active { color: white !important; font-weight: bold; }
    .route-icon { margin-right: 10px; font-size: 1.2em; }
    .route-name { flex-grow: 1; }
    .route-status-indicator { font-size: 0.8em; margin-left: auto; opacity: 0.7; }
    .show-all-button { background-color: #6c757d; color: white; font-weight: bold; margin-bottom:10px; }
    .show-all-button:hover { background-color: #5a6268; }
    :global(body.dark-mode) .show-all-button { background-color: #5a6268; }
    :global(body.dark-mode) .show-all-button:hover { background-color: #495057; }
    .no-routes-message { text-align: center; color: #888; padding: 15px; font-style: italic; }
    :global(body.dark-mode) .no-routes-message { color: #aaa; }
</style>
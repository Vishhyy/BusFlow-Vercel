<!-- src/lib/components/BusListPopup.svelte -->
<script>
	import { isBusListPopupOpen, gtfsData, activeRoutePolylines } from '$lib/stores.js';
	import { get } from 'svelte/store'; // Import get to read store value
	import { getBusColor } from '$lib/utils.js'; // For styling active button

	export let onRouteSelect; // Callback function from +page.svelte to handle selection

	let routes = [];

	// Reactively update local routes when GTFS data is loaded or popup opens
	// Inside BusListPopup.svelte, reactive block:
	$: if ($gtfsData.routes && $gtfsData.routes.length > 0 && $isBusListPopupOpen) {
		const uniqueRoutesByName = new Map();
		$gtfsData.routes.forEach((r) => {
			const name = r.route_short_name?.trim() || r.route_long_name?.trim() || `Route ${r.route_id}`;
			// Use the first encountered route_id for a given name, or decide on a primary one
			if (!uniqueRoutesByName.has(name)) {
				uniqueRoutesByName.set(name, {
					id: r.route_id, // This will be the representative route_id for this name
					name: name,
					color: getBusColor(r.route_id) // Color based on the representative route_id
				});
			}
			// If you want to collect all route_ids associated with a short name,
			// you'd need a more complex structure and decide how clicking "Route 10"
			// should behave (e.g., show all "Route 10" variants, or pick one).
			// For now, this takes the first route_id for a unique name.
		});

		routes = Array.from(uniqueRoutesByName.values()).sort((a, b) => {
			const numA = parseInt(a.name.match(/^\d+/)?.[0], 10);
			const numB = parseInt(b.name.match(/^\d+/)?.[0], 10);
			if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
				return numA - numB;
			}
			return a.name.localeCompare(b.name);
		});
		console.log('BusListPopup: Unique routes processed for display:', routes.length);
	}

	function handleRouteClick(routeId) {
		console.log(`BusListPopup: Route button clicked - ${routeId}`);
		if (onRouteSelect) {
			onRouteSelect(routeId); // Notify parent component
		}
		// Consider if popup should close on selection:
		// $isBusListPopupOpen = false;
	}

	function handleShowAllClick() {
		console.log('BusListPopup: Show All / Clear Selection clicked.');
		if (onRouteSelect) {
			onRouteSelect(null); // Signal to clear route-specific display
		}
	}
</script>

{#if $isBusListPopupOpen}
	<div class="bus-list-popup-container">
		<div class="popup-header">
			<strong>Select a Route</strong>
			<button class="close-button" on:click={() => ($isBusListPopupOpen = false)} title="Close"
				>×</button
			>
		</div>
		<div class="popup-content">
			<button class="route-button show-all-button" on:click={handleShowAllClick}>
				Show All Routes / Clear Filter
			</button>
			{#if routes.length > 0}
				{#each routes as route (route.id)}
					{@const polylinesMap = get(activeRoutePolylines)}
					{@const isActive =
						polylinesMap && polylinesMap[route.id] && polylinesMap[route.id].length > 0}
					<button
						class="route-button"
						class:active={isActive}
						style={isActive
							? `background-color: ${route.color}; color: white; border-color: ${route.color};`
							: ''}
						on:click={() => handleRouteClick(route.id)}
						title={`Show Route ${route.name}`}
					>
						<span class="route-icon">🚍</span>
						<span class="route-name">{route.name}</span>
						{#if isActive}
							<span class="route-status-indicator">(Visible)</span>
						{/if}
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
	/* Add or ensure these styles are present and adapt as needed */
	.bus-list-popup-container {
		position: absolute;
		bottom: 85px; /* Adjust based on your map controls height */
		left: 15px;
		width: 250px; /* Or desired width */
		max-height: 45vh; /* Limit height, make it scrollable */
		background-color: white;
		border-radius: 8px;
		box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.25);
		z-index: 1002;
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
		padding: 10px 15px;
		border-bottom: 1px solid #eee;
		font-weight: bold;
	}
	:global(body.dark-mode) .popup-header {
		border-bottom-color: #555;
	}
	.close-button {
		background: none;
		border: none;
		font-size: 22px;
		cursor: pointer;
		color: #aaa;
		padding: 0;
		line-height: 1;
	}
	:global(body.dark-mode) .close-button {
		color: #888;
	}
	.close-button:hover {
		color: #333;
		:global(body.dark-mode) & {
			color: #eee;
		}
	}
	.popup-content {
		padding: 10px;
		overflow-y: auto;
		flex-grow: 1;
	}
	.route-button {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 10px;
		margin-bottom: 6px;
		border: 1px solid #ddd;
		background-color: #f9f9f9;
		color: #333;
		cursor: pointer;
		border-radius: 5px;
		text-align: left;
		font-size: 14px;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
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
		/* Style for the active route button */
		/* background-color will be set by inline style using route.color */
		color: white !important; /* Ensure text is visible on colored background */
		font-weight: bold;
	}
	.route-icon {
		margin-right: 10px;
		font-size: 1.2em;
	}
	.route-name {
		flex-grow: 1;
	}
	.route-status-indicator {
		font-size: 0.8em;
		margin-left: auto;
		opacity: 0.7;
	}
	.show-all-button {
		background-color: #6c757d;
		color: white;
		font-weight: bold;
	}
	.show-all-button:hover {
		background-color: #5a6268;
	}
	:global(body.dark-mode) .show-all-button {
		background-color: #5a6268;
	}
	:global(body.dark-mode) .show-all-button:hover {
		background-color: #495057;
	}
	.no-routes-message {
		text-align: center;
		color: #888;
		padding: 15px;
		font-style: italic;
	}
	:global(body.dark-mode) .no-routes-message {
		color: #aaa;
	}
</style>

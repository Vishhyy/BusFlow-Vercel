<script>
	import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';
	import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
	import {
		mapInstance,
		googleInstance,
		isDarkMode,
		gtfsData,
		liveBusData,
		selectedStop,
		isBusListPopupOpen,
		activeRoutePolylines,
		visibleStopOverlays, // visibleStopOverlays might not be used directly here anymore
		isMapReady
	} from '$lib/stores.js';
	import { loadGTFSData } from '$lib/services/gtfsProcessing.js';
	import { fetchLiveBusPositions } from '$lib/services/api.js';
	// Import all necessary functions from mapActions
	import {
		updateVisibleStops,
		updateBusMarkers,
		displaySingleRoute,
		displayMultipleRoutes
	} from '$lib/services/mapActions.js';
	import { browser } from '$app/environment';

	// Import UI Components
	import MapControls from '$lib/components/MapControls.svelte';
	import BusListPopup from '$lib/components/BusListPopup.svelte';
	import StopPopup from '$lib/components/StopPopup.svelte';

	// --- Constants ---
	const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
	const mapId = import.meta.env.VITE_GOOGLE_MAPS_ID; // Using Cloud Styling
	const FETCH_INTERVAL_MS = 7000; // Live bus update interval

	// --- Local State ---
	let mapContainerElement;
	let fetchIntervalId = null;
	let initializationError = null;
	let mapIdleListener = null; // To store the Google Maps event listener

	// --- Reactive Updates ---
	// Toggles body class for dark mode (if other UI elements use it)
	$: if (browser && $isDarkMode !== undefined) {
		// console.log(`Toggling body class for dark mode: ${$isDarkMode}`);
		document.body.classList.toggle('dark-mode', $isDarkMode);
	}

	// Update bus markers when live data changes and map is ready
	$: if ($isMapReady && $googleInstance && $mapInstance && $liveBusData) {
		updateBusMarkers($liveBusData);
	}

	function handleRouteSelectionChangeFromBusList(selectedIdsArray) { // Expects an array
        console.log("+page.svelte: Route selection array changed to:", selectedIdsArray);
        displayMultipleRoutes(selectedIdsArray);

        // Stop filtering logic for multiple routes is more complex.
        // For now, let's assume if any route is selected, we MIGHT want to show all stops,
        // or if specific stop filtering is needed, it would have to process all selectedIdsArray.
        // This part needs careful thought for UX.
        if (selectedIdsArray.length === 0) {
            console.log("+page.svelte: All route filters cleared, ensuring all stops are visible.");
            loadBusStops(); // Call without args to show all stops (current behavior)
        } else {
            console.warn(`+page.svelte: Stop filtering for multiple routes not yet implemented. All stops remain visible.`);
            // To filter for multiple routes, loadBusStops would need to accept an array
            // loadBusStops(selectedIdsArray);
        }
    }

	// --- Event Handlers ---
	// handleRouteSelectionFromPopup (for StopPopup) can still use displaySingleRoute
    function handleRouteSelectionFromStopPopup(routeId) {
        console.log("+page.svelte: Single route selected from StopPopup:", routeId);
        displaySingleRoute(routeId); // This now calls displayMultipleRoutes internally

        // Stop filtering logic as before for single route from StopPopup
        if (routeId === null) { loadBusStops(); }
        else { /* console.warn for stop filtering */ }
    }

	// --- Lifecycle Functions ---
	onMount(async () => {
		if (!browser) return; // Should always be true for onMount

		initializationError = null;
		$isMapReady = false; // Ensure map readiness is false initially
		document.body.classList.toggle('dark-mode', $isDarkMode); // Set initial body class

		if (!apiKey || !mapId) {
			initializationError = 'Map API Key or Map ID is missing in environment variables.';
			console.error(initializationError);
			return;
		}

		try {
			console.log('🚀 Initializing Map Loader...');
			const loader = new GoogleMapsLoader.Loader({
				apiKey,
				version: 'beta',
				libraries: ['marker', 'geometry']
			});
			const google = await loader.load();

			if (!mapContainerElement || !google) {
				// Check if component unmounted during async load
				throw new Error('Map container reference lost or Google Maps Loader failed.');
			}
			googleInstance.set(google);
			console.log('✅ Google Maps API loaded.');

			console.log('🗺️ Creating Map Instance with Map ID:', mapId);
			const map = new google.maps.Map(mapContainerElement, {
				center: { lat: 50.4452, lng: -104.6189 }, // Regina, SK
				zoom: 12, // Initial zoom
				mapId: mapId,
				disableDefaultUI: true,
				zoomControl: true,
				mapTypeControl: false,
				streetViewControl: false,
				fullscreenControl: true,
				gestureHandling: 'greedy'
			});
			mapInstance.set(map);
			console.log('✅ Map Instance Created.');

			// Map is now created, mark as ready
			isMapReady.set(true);
			console.log('🚩 Map is Ready');

			// Add map 'idle' listener to update stops when map movement ends
			mapIdleListener = map.addListener('idle', () => {
				// console.log("Map idle, attempting to update visible stops.");
				if (get(isMapReady) && get(gtfsData)?.stops?.length > 0) {
					updateVisibleStops();
				} else {
					// console.log("Skipping stop update: Map not ready or no GTFS stops.");
				}
			});
			console.log('👂 Map idle listener attached.');

			// --- Load Static GTFS Data ---
			console.log('⏳ Loading static GTFS data...');
			const staticData = await loadGTFSData();
			if (!staticData || !staticData.routes || !staticData.stops) {
				// Basic check
				throw new Error('GTFS data loading failed or returned invalid structure.');
			}
			gtfsData.set(staticData);
			console.log(
				'✅ Static GTFS data loaded into store. Routes:',
				staticData.routes.length,
				'Stops:',
				staticData.stops.length,
				'Shapes:',
				Object.keys(staticData.shapes).length
			);

			// Initial call to render stops for the current view (after GTFS is loaded)
			updateVisibleStops();

			// --- Fetch Live Bus Data ---
			console.log('🚌 Initial bus data fetch...');
			const initialBusData = await fetchLiveBusPositions();
			liveBusData.set(initialBusData); // Triggers reactive updateBusMarkers

			console.log(`🔄 Starting live bus update interval (${FETCH_INTERVAL_MS}ms)...`);
			fetchIntervalId = setInterval(async () => {
				if (!document.hidden && $isMapReady) {
					// Only fetch if tab active and map ready
					try {
						const newData = await fetchLiveBusPositions();
						if (JSON.stringify(newData) !== JSON.stringify($liveBusData)) {
							liveBusData.set(newData);
						}
					} catch (err) {
						console.error('Error fetching live bus data in interval:', err);
					}
				}
			}, FETCH_INTERVAL_MS);

			console.log('🎉 Full Initialization Complete.');
		} catch (error) {
			console.error('❌ Error during map/data initialization:', error);
			initializationError = `Failed to initialize: ${error.message || String(error)}`;
			isMapReady.set(false); // Ensure map is not marked as ready on error
		}
	});

	onDestroy(() => {
		console.log('🧹 Component destroying...');
		const currentGoogle = get(googleInstance); // Use get() for potentially null values
		const currentMap = get(mapInstance);
		// const mapWasReady = get(isMapReady); // Not strictly needed here for listener removal

		if (browser) {
			// All cleanup should be browser-only
			console.log('🧹 Cleaning up browser resources...');

			// Clear live bus update interval
			if (fetchIntervalId) {
				clearInterval(fetchIntervalId);
				console.log(' Live update interval cleared.');
				fetchIntervalId = null;
			}

			// Remove map idle listener
			if (mapIdleListener) {
				console.log(' Removing map idle listener.');
				// google.maps.event.removeListener(mapIdleListener) is for older listeners
				// For listeners added with map.addListener('event', handler), just call .remove() on the listener object
				try {
					mapIdleListener.remove();
				} catch (e) {
					console.warn('Error removing map idle listener:', e);
				}
				mapIdleListener = null;
			}

			// Clear Google Maps instance listeners (general cleanup)
			if (currentGoogle?.maps?.event && currentMap) {
				try {
					currentGoogle.maps.event.clearInstanceListeners(currentMap);
					console.log(' General map instance listeners cleared.');
				} catch (e) {
					console.warn(' Error clearing general map instance listeners:', e);
				}
			} else {
				console.log(' Skipping general map listener cleanup: Google/Map instance not available.');
			}

			// Optional: Command mapActions to clear its managed markers if it has a specific cleanup function
			// e.g., clearAllStopMarkers(); clearAllBusMarkers();

			document.body.classList.remove('dark-mode'); // Clean up body class
		}

		// Reset Svelte stores
		console.log(' Resetting stores...');
		mapInstance.set(null);
		googleInstance.set(null);
		isMapReady.set(false);
		gtfsData.set({ routes: [], stops: [], shapes: {}, routeToShapeMap: {} });
		liveBusData.set([]);
		selectedStop.set(null);
		isDarkMode.set(false);
		isBusListPopupOpen.set(false);
		activeRoutePolylines.set({});
		visibleStopOverlays.set([]); // This store is managed by mapActions.js directly if it keeps track
		console.log(' Cleanup complete.');
	});
</script>

// <BusListPopup onRouteSelectionChange={handleRouteSelectionChangeFromBusList} />

<!-- Map Container & UI Components -->
<div bind:this={mapContainerElement} id="map-container">
	{#if !browser && typeof window === 'undefined'}
		<!-- Show only during true SSR, not client-side pre-hydration -->
		<p class="ssr-placeholder">Loading map application...</p>
	{:else if initializationError}
		<div class="error-indicator">Error: {initializationError}</div>
	{:else if !$isMapReady}
		<div class="loading-indicator">Initializing Map & Data...</div>
	{/if}
	<!-- Map is always in DOM for Google Maps to attach to, visibility of content managed by isMapReady -->
</div>

{#if $isMapReady && browser }
    <MapControls />
    <BusListPopup onRouteSelectionChange={handleRouteSelectionChangeFromBusList} />
    <StopPopup /> 
{/if}

<style>
	#map-container {
		width: 100vw;
		height: 100vh;
		position: absolute;
		top: 0;
		left: 0;
		background-color: #f0f0f0; /* Light placeholder */
		z-index: 0;
	}
	:global(body) {
		margin: 0;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Oxygen,
			Ubuntu,
			Cantarell,
			'Open Sans',
			'Helvetica Neue',
			sans-serif;
		overflow: hidden;
		background-color: #fff;
	}
	:global(body.dark-mode) {
		background-color: #1a1a1a;
		color: #eee;
	}
	:global(body.dark-mode) #map-container {
		background-color: #333; /* Darker placeholder */
	}

	.loading-indicator,
	.error-indicator,
	.ssr-placeholder {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 15px 25px;
		background: rgba(0, 0, 0, 0.85);
		color: white;
		border-radius: 8px;
		z-index: 10;
		text-align: center;
		font-size: 1.1em;
	}
	.error-indicator {
		background: rgba(200, 0, 0, 0.85);
	}
	.ssr-placeholder {
		background: rgba(50, 50, 50, 0.85);
	}
</style>

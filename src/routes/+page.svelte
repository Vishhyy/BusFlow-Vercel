<script>
  import { onMount, onDestroy } from 'svelte';
  import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
  import {
      mapInstance, googleInstance, isDarkMode, gtfsData, liveBusData, selectedStop,
      isBusListPopupOpen, activeRoutePolylines, visibleStopOverlays,
      isMapReady // Store to track map readiness
  } from '$lib/stores.js';
  import { loadGTFSData } from '$lib/services/gtfsProcessing.js';
  import { fetchLiveBusPositions } from '$lib/services/api.js';
  import { loadBusStops, updateBusMarkers } from '$lib/services/mapActions.js';
  // import { darkModeStyles, lightModeStyles } from '$lib/utils.js'; // No longer needed for map styling
  import { browser } from '$app/environment';

  // Import UI Components
  import MapControls from '$lib/components/MapControls.svelte';
  import BusListPopup from '$lib/components/BusListPopup.svelte';
  import StopPopup from '$lib/components/StopPopup.svelte';

  // --- Constants ---
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_ID; // Keep Map ID for Cloud Styling
  const FETCH_INTERVAL_MS = 2000; // Original interval (7 seconds)

  // --- Local State ---
  let mapContainerElement;
  let fetchIntervalId = null; // Store the interval ID
  let initializationError = null;

  // --- Reactive Updates ---
  // Only toggle body class based on isDarkMode store
  $: if (browser && $isDarkMode !== undefined) {
      console.log(`Toggling body class for dark mode: ${$isDarkMode}`);
      document.body.classList.toggle('dark-mode', $isDarkMode);
  }

  // Update bus markers when live data changes, requires map readiness
  $: if ($isMapReady && $googleInstance && $mapInstance && $liveBusData) {
       updateBusMarkers($liveBusData);
  }

  // --- Lifecycle Functions ---
  onMount(async () => {
       if (!browser) return;

       initializationError = null;
       $isMapReady = false;

       if (!apiKey || !mapId) {
           initializationError = "Map API Key or Map ID is missing.";
           console.error(initializationError);
           return;
       }

       // Set initial body class
       document.body.classList.toggle('dark-mode', $isDarkMode);

       try {
           console.log("🚀 Initializing Map Loader...");
           const loader = new GoogleMapsLoader.Loader({ apiKey, version: "beta", libraries: ["marker", "geometry"] });
           const google = await loader.load();

           if (!mapContainerElement || !google) throw new Error("Map container missing or Maps Loader failed.");
           googleInstance.set(google);
           console.log(" Google Maps API loaded.");

           console.log("🗺️ Creating Map Instance with Map ID:", mapId);
           const map = new google.maps.Map(mapContainerElement, {
               center: { lat: 50.4452, lng: -104.6189 }, zoom: 12, mapId: mapId,
               disableDefaultUI: true, zoomControl: true, mapTypeControl: false,
               streetViewControl: false, fullscreenControl: true, gestureHandling: "greedy"
           });
           mapInstance.set(map);
           console.log("✅ Map Instance Created.");

           isMapReady.set(true); // Mark map as ready
           console.log("🚩 Map is Ready");

           // --- Load Data ---
           console.log("⏳ Loading GTFS data...");
           const staticData = await loadGTFSData(); gtfsData.set(staticData); console.log("✅ GTFS data loaded.");
           loadBusStops();

           console.log("🚌 Initial bus data fetch...");
           const initialBusData = await fetchLiveBusPositions(); liveBusData.set(initialBusData);

           // --- Use setInterval as originally ---
           console.log(`🔄 Starting update interval (${FETCH_INTERVAL_MS}ms)...`);
           fetchIntervalId = setInterval(async () => {
                // Fetch only if browser tab visible and map is ready
                if (!document.hidden && $isMapReady) {
                    try {
                        // console.log("Interval: Fetching bus data..."); // Less frequent log
                        const newData = await fetchLiveBusPositions();
                        if (JSON.stringify(newData) !== JSON.stringify($liveBusData)) {
                            liveBusData.set(newData);
                        }
                    } catch (err) {
                        console.error("Error fetching in interval:", err);
                    }
                }
           }, FETCH_INTERVAL_MS); // Use the constant

           console.log("✅ Full Initialization Complete.");

       } catch (error) {
           console.error("❌ Error during map/data initialization:", error);
           initializationError = `Failed to initialize map: ${error.message || error}`;
           isMapReady.set(false);
       }
  });

  onDestroy(() => {
       console.log("🧹 Component destroying...");
       const currentGoogle = $googleInstance; const currentMap = $mapInstance; const mapWasReady = $isMapReady;

       if (browser) {
           console.log("🧹 Cleaning up browser resources...");
           // --- Clear the Interval ---
           if (fetchIntervalId) {
                clearInterval(fetchIntervalId); // Use clearInterval
                console.log(" Fetch interval cleared.");
                fetchIntervalId = null;
           }

           // Cleanup map listeners
           if (mapWasReady && currentGoogle && typeof currentGoogle.maps === 'object' && currentGoogle.maps !== null && currentMap) {
               try { currentGoogle.maps.event.clearInstanceListeners(currentMap); console.log(" Map listeners cleared."); }
               catch (e) { console.warn(" Error clearing map listeners:", e); }
           } else { console.log(" Skipping listener cleanup: Instances not available/ready at destroy."); }

           document.body.classList.remove('dark-mode');
       }

       // Reset stores
       console.log(" Resetting stores...");
       mapInstance.set(null); googleInstance.set(null); isMapReady.set(false);
       gtfsData.set({ routes: [], stops: [], shapes: {}, routeToShapeMap: {} });
       liveBusData.set([]); selectedStop.set(null); isDarkMode.set(false);
       isBusListPopupOpen.set(false); activeRoutePolylines.set({}); visibleStopOverlays.set([]);
       console.log(" Cleanup complete.");
  });
</script>

<!-- Map Container & UI Components -->
<div bind:this={mapContainerElement} id="map-container">
    {#if !browser} <p>Loading map...</p>
    {:else if initializationError} <div class="error-indicator">Error: {initializationError}</div>
    {:else if !$isMapReady} <div class="loading-indicator">Loading Map...</div> {/if}
</div>
{#if $isMapReady}
    <MapControls />
    <BusListPopup />
    <StopPopup />
{/if}

<style>
  #map-container { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; background-color: #f0f0f0; z-index: 0; }
  :global(body) { margin: 0; font-family: system-ui, sans-serif; overflow: hidden; background-color: #fff; }
  :global(body.dark-mode) { background-color: #1a1a1a; color: #eee; }
  :global(body.dark-mode) #map-container { background-color: #333; }
  .loading-indicator, .error-indicator { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 10px 20px; background: rgba(0,0,0,0.8); color: white; border-radius: 5px; z-index: 10; text-align: center; }
  .error-indicator { background: rgba(200, 0, 0, 0.8); }
</style>
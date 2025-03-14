<script>
    // Import necessary modules and components
    import { onMount } from "svelte";
    import * as GoogleMapsLoader from "@googlemaps/js-api-loader";
    import { loadGTFSData } from "$lib/processGTFS.js";
    import RouteSidebar from "$lib/RouteSidebar.svelte";

  // Define global variables
  let map;
  let isSidebarOpen = false;
  let selectedRoutes = [];
  let busMarkers = {}; // Stores bus marker elements
  let routePolylines = {}; // Stores route polylines for visibility toggling
  let previousBusPositions = {}; // Stores previous bus positions for smooth animation
  let arrowMarkers = {}; // Stores directional arrow markers for buses
  let isDarkMode = false;
  let stopMarkers = {}; // Stores bus stop markers
  let stopOverlays = []; // Stores stop overlays
  let activePopup = null; // Tracks currently open pop-up

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; // Google Maps API key
  const apiID = import.meta.env.VITE_GOOGLE_MAPS_ID;

  // Define dark mode styles for the map
  const darkModeStyles = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#37474F" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] }
  ];

  const lightModeStyles = []; // Light mode styles (default)

  // Toggle between dark mode and light mode
  function toggleMapStyle() {
    isDarkMode = !isDarkMode;
    map.setOptions({ styles: isDarkMode ? darkModeStyles : lightModeStyles });
  }

  // Opens the sidebar for a selected route
  function openSidebar(routeId) {
    isSidebarOpen = true;
    selectedRoutes = [routeId];
  }

  // Closes the sidebar
  function closeSidebar() {
    isSidebarOpen = false;
  }

  // Stores assigned route colors to ensure consistency
  const routeColors = {};

  // Predefined high-contrast, readable colors for bus routes
  const highContrastColors = [
    "#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#FFD700", "#FF8C00", "#8A2BE2",
    "#20B2AA", "#DC143C", "#00FA9A", "#FF4500", "#7FFF00", "#1E90FF", "#FF1493",
    "#32CD32", "#9932CC", "#4682B4", "#DAA520", "#FF6347", "#40E0D0"
  ];


  // Assigns a color to a route number, ensuring consistency
  function getBusColor(routeNumber) {
    if (!routeColors[routeNumber]) {
      routeColors[routeNumber] = highContrastColors[routeNumber % highContrastColors.length];
    }
    return routeColors[routeNumber];
  }

  // Toggles visibility of a bus route on the map
  async function toggleRouteVisibility(routeId, google) {
    try {
      const data = await loadGTFSData();
      const shapeMap = data.shapeMap;
      const routeToShapeMap = data.routeToShapeMap;

      if (!routeToShapeMap[routeId]) {
        console.warn(`❌ No shape ID found for route ${routeId}`);
        return;
      }

      const shapeIds = routeToShapeMap[routeId];
      const routeColor = getBusColor(parseInt(routeId));

      if (routePolylines[routeId]) {
        // Remove existing polylines
        routePolylines[routeId].forEach(polyline => polyline.setMap(null));
        delete routePolylines[routeId];
      } else {
        // Draw new polylines
        routePolylines[routeId] = [];
        shapeIds.forEach(shapeId => {
          if (!shapeMap[shapeId]) return;

          const polyline = new google.maps.Polyline({
            path: shapeMap[shapeId],
            geodesic: true,
            strokeColor: routeColor,
            strokeOpacity: 1.0,
            strokeWeight: 4,
            map: map,
          });

          routePolylines[routeId].push(polyline);
        });
      }
    } catch (error) {
      console.error("❌ Error toggling route visibility:", error);
    }
  }

  // Updates Arrow direction of Buses
  function updateArrowDirection(arrowMarker, heading, color) {
    const arrowCanvas = document.createElement("canvas");
    arrowCanvas.width = 24;
    arrowCanvas.height = 24;

    const ctx = arrowCanvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.translate(12, 12);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 10);
    ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill();

    arrowMarker.content = arrowCanvas;
  }

  // Updates Bus Position w/ new position
  function updateBusPosition(marker, newPosition) {
    if (!marker || !newPosition) return;
    marker.position = new google.maps.LatLng(newPosition.lat, newPosition.lng);
  }

  // Creates bus icon for Fetched buses
  function createBusIcon(routeNumber, color, heading) {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");

    ctx.translate(25, 25);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.translate(-25, -25);

    // Draw arrow (unchanged)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(25, 5);
    ctx.lineTo(30, 15);
    ctx.lineTo(20, 15);
    ctx.closePath();
    ctx.fill();

    // Reset transformations before drawing the bus number circle
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ✅ Reduce the bus number circle size (changed from 14 to 10)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(25, 30, 10, 0, Math.PI * 2);  // Reduced radius from 14 to 10
    ctx.fill();

    // Keep text size unchanged
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";  // No change to font size
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(routeNumber.toString(), 25, 30);

    return canvas;
  }

  // Fetch available bus routes for a specific stop
  async function fetchAvailableRoutes(stopId) {
    try {
      console.log(`🔍 Fetching routes for stop: ${stopId}`);
      const apiUrl = `https://stark-headland-53423-ad8df5faf2c9.herokuapp.com/api/bus-timings?stop=${stopId}&routes=all&lim=3&skip=0&ws=0`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      return [...new Set(data.map(bus => bus.route_id))]; // Extract unique route IDs
    } catch (error) {
      console.error("Error fetching available routes:", error);
      return [];
    }
  }

  // Shows Bus Times Pop-up when another api will be implemented
  function showBusTimesPopup(busTimesHtml) {
    let popup = document.getElementById("bus-times-popup");

    if (!popup) {
        popup = document.createElement("div");
        popup.id = "bus-times-popup";
        popup.style.position = "absolute";
        popup.style.background = "white";
        popup.style.border = "1px solid black";
        popup.style.padding = "10px";
        popup.style.borderRadius = "5px";
        popup.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
        popup.style.zIndex = "1000";
        popup.style.maxWidth = "250px";
        document.body.appendChild(popup);
    }

    popup.innerHTML = busTimesHtml + `<br><button class="popup-close" on:click={closeBusTimesPopup}>❌</button>`;
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.display = "block";
  }


  // // ✅ Add function to close the pop-up
  // function closeBusTimesPopup() {
  //     let popup = document.getElementById("bus-times-popup");
  //     if (popup) popup.style.display = "none";
  // }

  // Fetches Bus Timings from old API(Expired/Unimplemented) As of March 14, 2025
  async function fetchBusTimes(stopId, routeId) {
    try {
        console.log(`🛠 Fetching bus times for Stop ID: ${stopId}, Route ID: ${routeId}`);

        if (!stopId || !routeId) {
            console.error("🚨 Missing stopId or routeId!", { stopId, routeId });
            showBusTimesPopup(`<p style="color: red;">Error: Stop ID or Route is missing.</p>`);
            return;
        }

        // ✅ Updated API URL to use routeId instead of routeShortName
        const apiUrl = `https://stark-headland-53423-ad8df5faf2c9.herokuapp.com/api/bus-timings?stop=${stopId}&routes=${routeId}&lim=3&skip=0&ws=0`;
        console.log("📡 API Request:", apiUrl);

        const response = await fetch(apiUrl);
        const textResponse = await response.text(); // Capture raw API response

        if (!response.ok) {
            console.error("🚨 API Error Response:", textResponse);
            throw new Error(`HTTP ${response.status}: ${textResponse}`);
        }

        const data = JSON.parse(textResponse);
        console.log(`✅ Bus times for Stop ${stopId} on Route ${routeId}:`, data);

        if (!data || data.length === 0) {
            return showBusTimesPopup(`<p>No upcoming buses for Route ${routeId}.</p>`);
        }

        let busTimesHtml = data.map(bus => `
            <p><strong>Route ${bus.route_id}</strong> → Arriving at <strong>${bus.pred_time}</strong></p>
        `).join("");

        showBusTimesPopup(busTimesHtml);
    } catch (error) {
        console.error("❌ Error fetching bus times:", error);
        showBusTimesPopup(`<p style="color: red;">Failed to load bus times. ${error.message}</p>`);
    }
}

//   function closePopup() {
//     console.log("❌ Closing popup...");
//     let popup = document.getElementById("stop-popup");
//     if (popup) {
//         popup.style.display = "none";
//     }
// }

  // Function to Show Stop Pop-up (Expired/Unimplemented) As of March 14, 2025
  function showStopPopup(stop) {
    // ✅ Close any existing popups before opening a new one
    closePopup();

    console.log(`🚏 Showing popup for stop ID: ${stop.id}`);

    fetchAvailableRoutes(stop.id).then(routes => {
        let popup = document.getElementById("stop-popup");
        if (!popup) {
            popup = document.createElement("div");
            popup.id = "stop-popup";
            popup.className = "custom-popup";
            document.body.appendChild(popup);
        }

        let routesHtml = `
            <div class="popup-header">
                <strong>Choose a Route:</strong>
                <button class="popup-close" id="close-popup-btn">❌</button>
            </div>
            <div id="routes-container"></div>  <!-- ✅ Placeholder for routes -->
        `;

        popup.innerHTML = routesHtml;
        popup.style.display = "block";

        // ✅ Attach popup to a custom overlay to make it stick to the stop
        class StopPopupOverlay extends google.maps.OverlayView {
            constructor(stop) {
                super();
                this.stop = stop;
                this.div = popup;
                this.setMap(map);
            }

            onAdd() {
                const panes = this.getPanes();
                panes.floatPane.appendChild(this.div);
            }

            draw() {
                const projection = this.getProjection();
                if (!projection) return;

                setTimeout(() => {
                    const latLng = new google.maps.LatLng(this.stop.lat, this.stop.lng);
                    const point = projection.fromLatLngToDivPixel(latLng);

                    if (point) {
                        this.div.style.left = `${point.x}px`;
                        this.div.style.top = `${point.y}px`;
                    }
                }, 100);
            }

            onRemove() {
                if (this.div) {
                    this.div.parentNode.removeChild(this.div);
                    this.div = null;
                }
            }
        }

        const overlay = new StopPopupOverlay(stop);

        // ✅ Close popup event
        setTimeout(() => {
            document.getElementById("close-popup-btn")?.addEventListener("click", () => {
                overlay.setMap(null);
            });
        }, 0);

        // ✅ Add event listener to close popups when clicking elsewhere on the map
        google.maps.event.addListener(map, "gmp-click", () => {
            overlay.setMap(null);
        });

        // ✅ Add route buttons dynamically

        setTimeout(() => {
            const routesContainer = document.getElementById("routes-container");

            if (routes.length > 0) {
                routes.forEach(routeId => {
                    const routeBtn = document.createElement("button");
                    routeBtn.className = "route-btn";
                    routeBtn.innerText = `Route ${routeId}`;

                    // ✅ Use **routeId** instead of short name
                    routeBtn.addEventListener("click", () => fetchBusTimes(stop.id, routeId));

                    routesContainer.appendChild(routeBtn);
                    routesContainer.appendChild(document.createElement("br"));
                });
            } else {
                routesContainer.innerHTML = `<p class="popup-body" style="color: red;">No routes available.</p>`;
            }
        }, 0);
    });
}

// ✅ Define close functions correctly
let busTimesPopup;

// Closes the BusTimespopup (should not be needed) will be fixed w/ next update
function closeBusTimesPopup() {
    if (busTimesPopup) busTimesPopup.style.display = "none";
}

// same should be updated
function closePopup() {
    let popup = document.getElementById("stop-popup");
    if (popup) popup.style.display = "none";
}

// // ✅ Make sure closePopup() is globally available
// window.showStopPopup = showStopPopup;
// window.closePopup = function() {
//     let popup = document.getElementById("stop-popup");
//     if (popup) popup.style.display = "none";
// };

  // Shows selected route from sidebar
  function showRouteSelectionPopup(stopId, routes) {
    let popup = document.getElementById("stop-popup");

    if (!popup) {
        popup = document.createElement("div");
        popup.id = "stop-popup";
        popup.style.position = "absolute";
        popup.style.background = "white";
        popup.style.border = "1px solid black";
        popup.style.padding = "10px";
        popup.style.borderRadius = "5px";
        popup.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
        popup.style.zIndex = "1000";
        popup.style.maxWidth = "200px";
        document.body.appendChild(popup);
    }

    // ✅ Debug: Log available routes
    console.log(`Routes for stop ${stopId}:`, routes);

    let routeButtonsHtml = routes && routes.length > 0
        ? routes.map(route => `<button onclick="fetchBusTimes('${stopId}', '${route}')">Bus ${route}</button>`).join("<br>")
        : "<p style='color:red;'>No routes available.</p>";

    popup.innerHTML = `
        <strong>Choose a Route:</strong><br>
        ${routeButtonsHtml}
        <br>
        <button id="close-popup">❌ Close</button>
    `;

    popup.style.left = `${event.clientX + 10}px`;
    popup.style.top = `${event.clientY + 10}px`;
    popup.style.display = "block";

    document.getElementById("close-popup").addEventListener("click", () => {
        popup.style.display = "none";
    });
  }

  // loads bus stops when the api will be fixed
  async function loadBusStops(google) {
    const data = await loadGTFSData();
    if (!data || !data.stops) {
        console.error("❌ No stops found in GTFS data.");
        return;
    }

    const stops = data.stops;
    const MIN_ZOOM_LEVEL = 14;

    class StopOverlay extends google.maps.OverlayView {
    constructor(stop, googleInstance) {
        super();
        this.stop = stop;
        this.google = googleInstance;
        this.div = null;
    }

    onAdd() {
        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.backgroundColor = "yellow";
        this.div.style.border = "2px solid black"; // Keeps it visible
        this.div.style.cursor = "pointer"; // Ensure it's clickable
        this.div.style.display = "none";

        this.div.addEventListener("click", (event) => {
            event.stopPropagation();
            console.log(`🚏 Clicked stop: ${this.stop.id}`);
            showStopPopup({ id: this.stop.id }, event.clientX, event.clientY);
        });

        this.getPanes().overlayMouseTarget.appendChild(this.div);
    }

    draw() {
        if (!this.google || !this.getProjection()) return;
        const position = this.getProjection().fromLatLngToDivPixel(
            new this.google.maps.LatLng(this.stop.lat, this.stop.lng)
        );

        // 🔥 Adjusted smaller size: Min 8px, Max 18px
        const zoom = map.getZoom();
        let size = Math.min(8 + (zoom - 12) * 2, 18); // Smaller max size

        this.div.style.width = `${size}px`;
        this.div.style.height = `${size}px`;
        this.div.style.left = `${position.x - size / 2}px`;  // Center the square
        this.div.style.top = `${position.y - size / 2}px`;   // Center the square
        this.div.style.display = zoom >= 12 ? "block" : "none"; // Show only at zoom level 12+
    }
}


    stops.forEach(stop => {
        const overlay = new StopOverlay(stop, google);
        overlay.setMap(map);
        stopOverlays.push(overlay);
    });

    console.log(`✅ Loaded ${stops.length} stops`);
  }

  // loader
  onMount(async () => {
    try {
      const loader = new GoogleMapsLoader.Loader({
        apiKey,
        version: "beta",
        libraries: ["geometry", "marker"]
      });

      const google = await loader.load();
      map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 50.4452, lng: -104.6189 },
        zoom: 12,
        disableDefaultUI: false,
        mapId: apiID,
        gestureHandling: "greedy"
      });

      google.maps.event.addListener(map, "zoom_changed", () => {
        Object.values(busMarkers).forEach(marker => {
          marker.position = marker.position;
          marker.map = map;
        });
      });

      // ✅ Load and display bus stops
      await loadBusStops(google);
      fetchLiveBusPositions(google);
      setInterval(() => fetchLiveBusPositions(google), 5000);
    } catch (error) {
      console.error("Error loading Google Maps:", error);
    }
  });

  // log for Umo app button
  function addUmoAppButton() {
    const umoButton = document.createElement("button");
    umoButton.style.position = "absolute";
    umoButton.style.bottom = "20px";  // ✅ Bottom-left positioning
    umoButton.style.left = "20px";
    umoButton.style.zIndex = "1000";
    umoButton.style.width = "60px";  // ✅ Increased size to match PayPal button
    umoButton.style.height = "60px";
    umoButton.style.borderRadius = "50%";
    umoButton.style.backgroundColor = "white";
    umoButton.style.border = "none";
    umoButton.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
    umoButton.style.cursor = "pointer";
    umoButton.style.padding = "5px";
    umoButton.style.display = "flex";
    umoButton.style.justifyContent = "center";
    umoButton.style.alignItems = "center";
    umoButton.style.overflow = "hidden";

    // ✅ Use a reliable Umo App icon URL
    const umoIcon = document.createElement("img");
    umoIcon.src = "https://play-lh.googleusercontent.com/tiVl9bt_gtLWAOBdk0Y3Wh9FYYCzXIdyBhtheH_aw_IKYpF9mfMgQ2wXgQTKdL5OxA";  
    umoIcon.style.width = "90%";  // ✅ Increased size to fill button
    umoIcon.style.height = "90%";
    umoIcon.style.borderRadius = "50%";
    umoIcon.style.objectFit = "contain";  // ✅ Ensures the full logo is visible

    // ✅ Fallback if the icon fails to load
    umoIcon.onerror = () => {
        umoIcon.src = "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png"; // Transparent fallback
    };

    umoButton.appendChild(umoIcon);

    // ✅ Open Umo App when clicked
    umoButton.addEventListener("click", () => {
        window.open("https://urldefense.com/v3/__https:/play.google.com/store/apps/details?id=com.cubic.ctp.app&pli=1__;!!Ooxr18I!Dja-nK1jDKXISDp6As8J3WE94PxNuVzkV_N6XZ15ugYEfvkaHkNoz3-U29lR0ZMfLtA5Eam_kAooS0db4LZV$", "https://umomobility.com");  // Replace with actual deep link if available
    });

    // ✅ Add to the map container
    document.body.appendChild(umoButton);
  }

  // log for Donation button
  function addDonationButton() {
      const donationButton = document.createElement("button");
      donationButton.style.position = "absolute";
      donationButton.style.bottom = "20px";  
      donationButton.style.left = "90px";  // Positioned beside Umo button
      donationButton.style.zIndex = "1000";
      donationButton.style.width = "60px";  
      donationButton.style.height = "60px";
      donationButton.style.borderRadius = "50%";
      donationButton.style.backgroundColor = "#FFD700";  // Gold color for donation
      donationButton.style.border = "none";
      donationButton.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
      donationButton.style.cursor = "pointer";
      donationButton.style.display = "flex";
      donationButton.style.justifyContent = "center";
      donationButton.style.alignItems = "center";
      donationButton.style.fontSize = "30px";
      donationButton.style.fontWeight = "bold";
      donationButton.style.color = "white";

      donationButton.textContent = "💲";  // Dollar icon

      donationButton.addEventListener("click", () => {
          window.open("https://www.paypal.com/donate/?business=83A9DBK7SWS4E&no_recurring=0&item_name=Thank+you+for+your+support+%21+&currency_code=CAD", "_blank");  // Replace with actual donation link
      });

      document.body.appendChild(donationButton);
  }

  let activeRouteId = null; // ✅ Store currently active route

  // log for Bus List button
  function addBusListButton() {
      const busListButton = document.createElement("button");
      busListButton.style.position = "absolute";
      busListButton.style.bottom = "20px";  
      busListButton.style.left = "160px";  
      busListButton.style.zIndex = "1000";
      busListButton.style.width = "60px";  
      busListButton.style.height = "60px";
      busListButton.style.borderRadius = "50%";
      busListButton.style.backgroundColor = "#3498db";  
      busListButton.style.border = "none";
      busListButton.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
      busListButton.style.cursor = "pointer";
      busListButton.style.display = "flex";
      busListButton.style.justifyContent = "center";
      busListButton.style.alignItems = "center";
      busListButton.style.fontSize = "24px";
      busListButton.style.fontWeight = "bold";
      busListButton.style.color = "white";

      busListButton.textContent = "🚌";  

      const busListPopup = document.createElement("div");
      busListPopup.style.position = "absolute";
      busListPopup.style.bottom = "90px";  
      busListPopup.style.left = "20px";
      busListPopup.style.width = "220px";
      busListPopup.style.maxHeight = "300px";
      busListPopup.style.overflowY = "auto";
      busListPopup.style.backgroundColor = "white";
      busListPopup.style.border = "1px solid #ccc";
      busListPopup.style.boxShadow = "0px 2px 10px rgba(0,0,0,0.3)";
      busListPopup.style.padding = "10px";
      busListPopup.style.borderRadius = "10px";
      busListPopup.style.display = "none";

      document.body.appendChild(busListPopup);

      async function loadBusList() {
          try {
              const data = await loadGTFSData();
              const routeToShapeMap = data.routeToShapeMap;
              busListPopup.innerHTML = "<strong>Select a Bus Route:</strong><br><br>";

              const routeIds = Object.keys(routeToShapeMap);
              if (routeIds.length === 0) {
                  busListPopup.innerHTML += "<p>No bus routes available.</p>";
                  return;
              }

              routeIds.forEach(routeId => {
                  const routeButton = document.createElement("button");
                  routeButton.textContent = `🚍 Route ${routeId}`;
                  routeButton.style.display = "block";
                  routeButton.style.width = "100%";
                  routeButton.style.marginBottom = "5px";
                  routeButton.style.padding = "8px";
                  routeButton.style.border = "none";
                  routeButton.style.backgroundColor = "#f1f1f1";  
                  routeButton.style.cursor = "pointer";
                  routeButton.style.borderRadius = "5px";
                  routeButton.style.color = "black";
                  routeButton.dataset.routeId = routeId;

                  // ✅ Toggle route on/off when clicking the button
                  routeButton.addEventListener("click", () => {
                      console.log(`Route ${routeId} clicked.`);

                      if (activeRouteId === routeId) {
                          // ✅ If the same route is clicked again, hide it
                          console.log(`Hiding Route ${routeId}`);
                          toggleRouteVisibility(routeId, google);
                          activeRouteId = null;

                          // ✅ Reset button color
                          routeButton.style.backgroundColor = "#f1f1f1";  
                          routeButton.style.color = "black";  
                      } else {
                          console.log(`Showing Route ${routeId}`);

                          // ✅ Hide previous route
                          if (activeRouteId) {
                              toggleRouteVisibility(activeRouteId, google);
                              document.querySelectorAll("[data-route-id]").forEach(btn => {
                                  btn.style.backgroundColor = "#f1f1f1";  
                                  btn.style.color = "black";  
                              });
                          }

                          // ✅ Show new route
                          toggleRouteVisibility(routeId, google);
                          activeRouteId = routeId; 

                          // ✅ Change button color to match the route
                          const routeColor = getBusColor(routeId);
                          routeButton.style.backgroundColor = routeColor;
                          routeButton.style.color = "white";  
                      }
                  });

                  busListPopup.appendChild(routeButton);
              });

          } catch (error) {
              console.error("Error loading bus routes:", error);
              busListPopup.innerHTML = "<p style='color: red;'>Failed to load bus routes.</p>";
          }
      }

      busListButton.addEventListener("click", () => {
          if (busListPopup.style.display === "none") {
              busListPopup.style.display = "block";
              loadBusList();  
          } else {
              busListPopup.style.display = "none";
          }
      });

      document.body.appendChild(busListButton);
  }


  // ✅ Initialize buttons when map loads
  onMount(() => {
      addUmoAppButton();
      addDonationButton();
      addBusListButton();
  });

  // for smooth bus moves instead of straight position update
  function smoothMoveMarker(marker, newPosition) {
    if (!marker || !newPosition) return;

    // ✅ Validate lat/lng before using them (fixes check for 0 values)
    if (newPosition.lat == null || newPosition.lng == null || isNaN(newPosition.lat) || isNaN(newPosition.lng)) {
        console.error("❌ Invalid coordinates in smoothMoveMarker:", newPosition);
        return; // Skip the update if invalid
    }

    let currentPosition = marker.position;

    // ✅ Ensure currentPosition is a valid Google Maps LatLng object
    if (!(currentPosition instanceof google.maps.LatLng)) {
        currentPosition = new google.maps.LatLng(newPosition.lat, newPosition.lng);
    }

    if (isNaN(currentPosition.lat()) || isNaN(currentPosition.lng())) {
        console.error("❌ Invalid current position:", currentPosition);
        return; // Prevent crashes if marker has invalid position
    }

    const deltaLat = (newPosition.lat - currentPosition.lat()) / 10;
    const deltaLng = (newPosition.lng - currentPosition.lng()) / 10;

    let i = 0;
    const interval = setInterval(() => {
        i++;
        const lat = currentPosition.lat() + deltaLat * i;
        const lng = currentPosition.lng() + deltaLng * i;

        if (isNaN(lat) || isNaN(lng)) {
            console.error("❌ NaN detected during animation:", { lat, lng });
            clearInterval(interval);
            return;
        }

        marker.position = new google.maps.LatLng(lat, lng);
        if (i >= 10) clearInterval(interval);
    }, 50);
}

  // calculates the direction for busesusing old n new positions
  function calculateHeading(previousPosition, newPosition) {
    if (!previousPosition) return 0;

    const lat1 = (previousPosition.lat * Math.PI) / 180;
    const lat2 = (newPosition.lat * Math.PI) / 180;
    const deltaLng = ((newPosition.lng - previousPosition.lng) * Math.PI) / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    let heading = (Math.atan2(y, x) * 180) / Math.PI;
    return heading < 0 ? heading + 360 : heading;
  }

  const API_URL = import.meta.env.VITE_API_URL;
  // ✅ Define previousBusData globally before using it
let previousBusData = null; 

    // Fetches live bus positions w/ use of API
    async function fetchLiveBusPositions(google) {
        try {
            console.log("📡 Fetching live bus data from TransitLive...");

            const response = await fetch(API_URL, {
                mode: "cors",
                headers: {
                    "Content-Type": "application/json",
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch data`);

            const data = await response.json();
            console.log("✅ Parsed API Response:", data);

            if (!Array.isArray(data) || data.length === 0) {
                console.warn("⚠️ No live buses found.");
                return;
            }

            // ✅ Check if previousBusData exists and compare with new data
            if (previousBusData && JSON.stringify(previousBusData) === JSON.stringify(data)) {
                console.warn("⚠️ Same bus data received, skipping update.");
                return;
            }

            previousBusData = data; // ✅ Store latest data

            data.forEach(bus => {
                const busId = bus.properties.b;
                const routeId = bus.properties.r;
                const busLine = bus.properties.line;

                // ✅ Extract correct latitude & longitude values
                if (!bus.geometry || !bus.geometry.coordinates || bus.geometry.coordinates.length !== 2) {
                    console.error(`❌ Invalid coordinates for Bus ${busId} on Route ${routeId}:`, bus.geometry);
                    return;
                }

                const newPosition = {
                    lat: parseFloat(bus.geometry.coordinates[1]), // Latitude
                    lng: parseFloat(bus.geometry.coordinates[0])  // Longitude
                };

                if (isNaN(newPosition.lat) || isNaN(newPosition.lng)) {
                    console.error(`❌ NaN detected in coordinates for Bus ${busId}:`, newPosition);
                    return;
                }

                console.log(`🚌 Bus ${busId} on Route ${routeId} →`, newPosition);

                if (busMarkers[busId]) {
                    // ✅ Calculate heading using previous position
                    const previousPosition = previousBusPositions[busId] || newPosition; // Use new position if first time
                    const heading = calculateHeading(previousPosition, newPosition);
                    previousBusPositions[busId] = newPosition; // Store new position

                    // ✅ Update bus icon with new heading
                    const busColor = getBusColor(routeId);
                    const updatedIcon = createBusIcon(routeId, busColor, heading);
                    busMarkers[busId].content = updatedIcon;

                    // ✅ Smoothly move the marker
                    smoothMoveMarker(busMarkers[busId], newPosition);

                } else {
                    // ✅ First-time marker creation
                    const busColor = getBusColor(routeId);
                    const heading = calculateHeading(null, newPosition);
                    const busIcon = createBusIcon(routeId, busColor, heading);

                    const busMarker = new google.maps.marker.AdvancedMarkerElement({
                        position: newPosition,
                        map: map,
                        title: `Bus ${busId} - ${busLine}`,
                        content: busIcon,
                        zIndex: 100,
                    });

                    busMarkers[busId] = busMarker;
                    previousBusPositions[busId] = newPosition;
                }
            });

        } catch (error) {
            console.error("❌ Error fetching live bus positions:", error);
        }
    }

</script>

<style>
  /* Ensure map takes full viewport */
  html, body, #map {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .custom-popup {
    position: absolute;
    background: white;
    border: 1px solid #333;
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0px 4px 10px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 250px;
    font-family: Arial, sans-serif;
  }

  .popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      margin-bottom: 10px;
  }

  .popup-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: red;
  }

  .popup-body {
      margin-top: 5px;
  }

  .route-btn {
      display: block;
      width: 100%;
      padding: 8px;
      margin-top: 5px;
      border: none;
      background-color: #007BFF;
      color: white;
      font-size: 14px;
      cursor: pointer;
      border-radius: 5px;
  }

  .route-btn:hover {
      background-color: #0056b3;
  }

</style>


<div id="map"></div>

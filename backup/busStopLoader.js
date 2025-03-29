// function file for busstops   -> busStopLoader.js

// function showBusTimesPopup           -> fetchBusTimes
// function showStopPopup               -> loadBusStops
// function closeBusTimesPopup          -> showBusTimesPopup
// function closePopup                  -> showStopPopup
// function showRouteSelectionPopup     -> not called anywhere
// async function loadBusStops          -> onMount

import { fetchAvailableRoutes, loadGTFSData } from "../src/lib/processGTFS"; 
import { fetchBusTimes } from "./busTimesLoader";

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

// Closes the BusTimespopup (should not be needed) will be fixed w/ next update
function closeBusTimesPopup() {
    if (busTimesPopup) busTimesPopup.style.display = 'none';
}

// same should be updated
function closePopup() {
    let popup = document.getElementById('stop-popup');
    if (popup) popup.style.display = 'none';
}

// Shows selected route from sidebar
function showRouteSelectionPopup(stopId, routes) {
    let popup = document.getElementById('stop-popup');

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'stop-popup';
        popup.style.position = 'absolute';
        popup.style.background = 'white';
        popup.style.border = '1px solid black';
        popup.style.padding = '10px';
        popup.style.borderRadius = '5px';
        popup.style.boxShadow = '0px 2px 10px rgba(0,0,0,0.3)';
        popup.style.zIndex = '1000';
        popup.style.maxWidth = '200px';
        document.body.appendChild(popup);
    }

    // ✅ Debug: Log available routes
    console.log(`Routes for stop ${stopId}:`, routes);

    let routeButtonsHtml =
        routes && routes.length > 0
            ? routes
                .map(
                    (route) =>
                        `<button onclick="fetchBusTimes('${stopId}', '${route}')">Bus ${route}</button>`
                )
                .join('<br>')
            : "<p style='color:red;'>No routes available.</p>";

    popup.innerHTML = `
        <strong>Choose a Route:</strong><br>
        ${routeButtonsHtml}
        <br>
        <button id="close-popup">❌ Close</button>
    `;

    popup.style.left = `${event.clientX + 10}px`;
    popup.style.top = `${event.clientY + 10}px`;
    popup.style.display = 'block';

    document.getElementById('close-popup').addEventListener('click', () => {
        popup.style.display = 'none';
    });
}

// loads bus stops when the api will be fixed
async function loadBusStops(google) {
    const data = await loadGTFSData();
    if (!data || !data.stops) {
        console.error('❌ No stops found in GTFS data.');
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
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.backgroundColor = 'yellow';
            this.div.style.border = '2px solid black'; // Keeps it visible
            this.div.style.cursor = 'pointer'; // Ensure it's clickable
            this.div.style.display = 'none';

            this.div.addEventListener('click', (event) => {
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
            this.div.style.left = `${position.x - size / 2}px`; // Center the square
            this.div.style.top = `${position.y - size / 2}px`; // Center the square
            this.div.style.display = zoom >= 12 ? 'block' : 'none'; // Show only at zoom level 12+
        }
    }

    stops.forEach((stop) => {
        const overlay = new StopOverlay(stop, google);
        overlay.setMap(map);
        stopOverlays.push(overlay);
    });

    console.log(`✅ Loaded ${stops.length} stops`);
}

export {showBusTimesPopup, showStopPopup, loadBusStops};
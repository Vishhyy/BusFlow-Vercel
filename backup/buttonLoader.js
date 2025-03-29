// function file for buttons    -> buttonLoader.js

// function addUmoAppButton     -> in onMount
// function addDonationButton   -> in onMount
// function addBusListButton    -> in onMount

import { getBusColor } from "./busIconLoader";

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

export {addUmoAppButton, addDonationButton, addBusListButton};
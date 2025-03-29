// function file for busdesign      -> busIconLoader.js

// function createBusIcon           -> fetchLiveBusPositions
// function getBusColor             -> toggleRouteVisibility, addBusListButton
// function updateArrowDirection    -> not called anywhere
// function updateBusPosition       -> not called anywhere

// Creates bus icon for Fetched buses
const routeColors = {}; // ✅ Keep route colors inside busIconLoader.js

const highContrastColors = [
    "#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#FFD700",
    "#FF8C00", "#8A2BE2", "#20B2AA", "#DC143C", "#00FA9A",
    "#FF4500", "#7FFF00", "#1E90FF", "#FF1493", "#32CD32",
    "#9932CC", "#4682B4", "#DAA520", "#FF6347", "#40E0D0"
];

function createBusIcon(routeNumber, color, heading) {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');

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
    ctx.arc(25, 30, 10, 0, Math.PI * 2); // Reduced radius from 14 to 10
    ctx.fill();

    // Keep text size unchanged
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial'; // No change to font size
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(routeNumber.toString(), 25, 30);

    return canvas;
}

// Assigns a color to a route number, ensuring consistency
function getBusColor(routeNumber) {
    if (!routeColors[routeNumber]) {
        routeColors[routeNumber] = highContrastColors[routeNumber % highContrastColors.length];
    }
    return routeColors[routeNumber];
}

// Updates Arrow direction of Buses
function updateArrowDirection(arrowMarker, heading, color) {
    const arrowCanvas = document.createElement('canvas');
    arrowCanvas.width = 24;
    arrowCanvas.height = 24;

    const ctx = arrowCanvas.getContext('2d');
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

export {createBusIcon, getBusColor};
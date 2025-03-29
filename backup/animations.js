// function file for animations -> animations.js

// smoothMoveMarker -> fetchLiveBusPositions

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

export {smoothMoveMarker};
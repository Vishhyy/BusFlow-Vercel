// function file for calculations   -> calculations.js

// calculateHeading used in -> fetchLiveBusPositions

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

export {calculateHeading};
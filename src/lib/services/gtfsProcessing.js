// src/lib/services/gtfsProcessing.js

/**
 * Basic CSV parser.
 * Assumes the first line is the header.
 * @param {string} csvText - The CSV content as a string.
 * @returns {Array<Object>} An array of objects, where keys are header names.
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r\n|\n|\r/); // Handle different line endings
    if (lines.length < 2) return []; // Need header + at least one data line

    const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '')); // Trim and remove quotes
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines

        const values = lines[i].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
        // A more robust CSV parser would handle commas within quoted fields,
        // but for standard GTFS this simple split often works.
        // If you have issues, consider a library like PapaParse.

        if (values.length === headers.length) {
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        } else {
            console.warn(`Skipping malformed CSV line ${i + 1}: Expected ${headers.length} values, got ${values.length}. Line: "${lines[i]}"`);
        }
    }
    return data;
}


export async function loadGTFSData() {
    console.log("⏳ Loading and processing GTFS data from static files...");

    const basePath = '/gtfs/'; // Path relative to the 'static' folder

    const filePaths = {
        routes: `${basePath}routes.txt`,
        stops: `${basePath}stops.txt`,
        trips: `${basePath}trips.txt`,
        shapes: `${basePath}shapes.txt`,
        // Optional: stop_times: `${basePath}stop_times.txt` // If needed for stop sequences on routes
    };

    const processedData = {
        routes: [],
        stops: [],
        shapes: {},          // { shape_id: [{lat, lng, sequence}, ...] } then sorted and mapped
        routeToShapeMap: {}  // { route_id: [shape_id, ...] }
    };

    try {
        // Fetch all necessary files concurrently
        const [
            routesText,
            stopsText,
            tripsText,
            shapesText
        ] = await Promise.all([
            fetch(filePaths.routes).then(res => { if (!res.ok) throw new Error(`Fetch failed for ${filePaths.routes}`); return res.text(); }),
            fetch(filePaths.stops).then(res => { if (!res.ok) throw new Error(`Fetch failed for ${filePaths.stops}`); return res.text(); }),
            fetch(filePaths.trips).then(res => { if (!res.ok) throw new Error(`Fetch failed for ${filePaths.trips}`); return res.text(); }),
            fetch(filePaths.shapes).then(res => { if (!res.ok) throw new Error(`Fetch failed for ${filePaths.shapes}`); return res.text(); })
        ]);

        // --- 1. Parse Routes ---
        const routesData = parseCSV(routesText);
        processedData.routes = routesData.map(r => ({
            route_id: r.route_id,
            route_short_name: r.route_short_name || '',
            route_long_name: r.route_long_name || '',
            route_color: r.route_color ? r.route_color.replace(/^#/, '') : null,
            route_text_color: r.route_text_color ? r.route_text_color.replace(/^#/, '') : null,
            // GTFS route_type is an enum (0: Tram, 1: Subway, 2: Rail, 3: Bus, etc.)
            // You might want to store this if you differentiate icon types later
        }));
        console.log(`Processed ${processedData.routes.length} routes.`);

        // --- 2. Parse Stops ---
        const stopsData = parseCSV(stopsText);
        processedData.stops = stopsData.map(s => ({
            stop_id: s.stop_id,
            stop_name: s.stop_name || '',
            stop_lat: parseFloat(s.stop_lat),
            stop_lon: parseFloat(s.stop_lon),
            // Other fields like stop_code, location_type, parent_station if needed
        })).filter(s => !isNaN(s.stop_lat) && !isNaN(s.stop_lon)); // Ensure valid coords
        console.log(`Processed ${processedData.stops.length} stops.`);


        // --- 3. Parse Shapes ---
        const shapesData = parseCSV(shapesText);
        const rawShapes = {}; // Intermediate: { shape_id: [{lat, lng, sequence}, ...] }
        shapesData.forEach(s => {
            const shapeId = s.shape_id;
            const lat = parseFloat(s.shape_pt_lat);
            const lon = parseFloat(s.shape_pt_lon);
            const sequence = parseInt(s.shape_pt_sequence, 10);

            if (shapeId && !isNaN(lat) && !isNaN(lon) && !isNaN(sequence)) {
                if (!rawShapes[shapeId]) {
                    rawShapes[shapeId] = [];
                }
                rawShapes[shapeId].push({ lat: lat, lng: lon, sequence: sequence });
            }
        });

        // Sort points within each shape by sequence and map to final format
        for (const shapeId in rawShapes) {
            processedData.shapes[shapeId] = rawShapes[shapeId]
                .sort((a, b) => a.sequence - b.sequence)
                .map(p => ({ lat: p.lat, lng: p.lng })); // Only lat, lng needed for polylines
        }
        console.log(`Processed ${Object.keys(processedData.shapes).length} unique shapes.`);


        // --- 4. Parse Trips to build routeToShapeMap ---
        const tripsData = parseCSV(tripsText); // Assuming tripsText is loaded content of trips.txt
        processedData.routeToShapeMap = {};    // Initialize as an empty object

        tripsData.forEach(trip => {
            // --- CRITICAL: ENSURE routeId IS A TRIMMED STRING ---
            const routeId = String(trip.route_id).trim();
            const shapeId = String(trip.shape_id).trim(); // Also good practice for shapeId

            if (routeId && shapeId && shapeId !== "") { // Ensure both exist and shapeId isn't just whitespace
                if (!processedData.routeToShapeMap[routeId]) {
                    processedData.routeToShapeMap[routeId] = new Set(); // Use a Set for unique shape_ids
                }
                processedData.routeToShapeMap[routeId].add(shapeId);
            } else if (routeId && (!shapeId || shapeId.trim() === "")) {
                // Optional: Log if a trip for a route is explicitly missing a shape_id
                // console.warn(`[GTFS Processing] Trip (ID: ${trip.trip_id || 'N/A'}) for route_id '${routeId}' is missing a shape_id in trips.txt.`);
            }
        });

        // Convert Sets to Arrays for the final routeToShapeMap structure
        for (const routeIdKey in processedData.routeToShapeMap) {
            processedData.routeToShapeMap[routeIdKey] = Array.from(processedData.routeToShapeMap[routeIdKey]);
        }
        console.log(`[GTFS Processing] Finished mapping routes to shapes. Total routes with shapes: ${Object.keys(processedData.routeToShapeMap).length}.`);

        // Diagnostic: Check a few specific route IDs that you know should exist
        // const sampleRouteIds = ['1', '3', '1-43', '10-43']; // Add relevant IDs from your data
        // sampleRouteIds.forEach(sampleId => {
        //     if (processedData.routeToShapeMap[sampleId]) {
        //         console.log(`[GTFS Processing] Route '${sampleId}' has shapes:`, processedData.routeToShapeMap[sampleId]);
        //     } else {
        //         console.warn(`[GTFS Processing] Route '${sampleId}' has NO shapes mapped.`);
        //     }
        // });


        // Final check against routes.txt to see if any defined routes have no shapes
        processedData.routes.forEach(route => {
            const currentRouteIdKey = String(route.route_id).trim();
            if (!processedData.routeToShapeMap[currentRouteIdKey] || processedData.routeToShapeMap[currentRouteIdKey].length === 0) {
                console.warn(`[GTFS Processing] Data Check: Route '${currentRouteIdKey}' (${route.route_short_name || route.route_long_name}) from routes.txt has no associated shapes in trips.txt. It cannot be drawn.`);
            }
        });

        console.log(`✅ GTFS data successfully processed.`);

        console.log("[GTFS Processing FINAL CHECK] ======= ROUTETOSHAPEMAP KEYS & TYPES =======");
        const routeToShapeMapKeys = Object.keys(processedData.routeToShapeMap);
        if (routeToShapeMapKeys.length > 0) {
            console.log(`[GTFS Processing FINAL CHECK] Sample routeToShapeMap keys (first 10):`);
            routeToShapeMapKeys.slice(0, 10).forEach(key => { // Log first 10
                console.log(`  - Key: '${key}', Type: ${typeof key}, Has Shapes: ${!!processedData.routeToShapeMap[key]?.length}`);
            });
            const testRouteId = '3'; // The one failing in StopPopup
            if (processedData.routeToShapeMap.hasOwnProperty(testRouteId)) {
                console.log(`[GTFS Processing FINAL CHECK] routeToShapeMap['${testRouteId}'] (string key): exists, Shapes:`, processedData.routeToShapeMap[testRouteId]);
            } else {
                console.log(`[GTFS Processing FINAL CHECK] routeToShapeMap['${testRouteId}'] (string key): DOES NOT EXIST`);
            }
            if (processedData.routeToShapeMap.hasOwnProperty(Number(testRouteId))) {
                console.log(`[GTFS Processing FINAL CHECK] routeToShapeMap[${Number(testRouteId)}] (numeric key): exists, Shapes:`, processedData.routeToShapeMap[Number(testRouteId)]);
            } else {
                console.log(`[GTFS Processing FINAL CHECK] routeToShapeMap[${Number(testRouteId)}] (numeric key): DOES NOT EXIST`);
            }
        } else { /* ... */ }

        return processedData;

    } catch (error) {
        console.error("❌ Error loading or processing GTFS data:", error);
        // Return a default empty structure on critical failure
        return { routes: [], stops: [], shapes: {}, routeToShapeMap: {} };
    }
}
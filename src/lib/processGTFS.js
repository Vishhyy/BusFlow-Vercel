// CSV parser function
function parseCSV(csvText) {
    const lines = csvText.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    const headers = lines.shift().split(",");
  
    return lines.map(line => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() || ""]));
    });
  }
  
  export async function loadGTFSData() {
    try {
      // Load routes.txt
      const routesResponse = await fetch("/gtfs/routes.txt");
      const routesText = await routesResponse.text();
      const routes = parseCSV(routesText);
  
      // Load trips.txt (to correctly link route_id to shape_id)
      const tripsResponse = await fetch("/gtfs/trips.txt");
      const tripsText = await tripsResponse.text();
      const trips = parseCSV(tripsText);
  
      // ✅ Create a route → shape mapping using trips.txt
      const routeToShapeMap = {};
      trips.forEach(row => {
        if (row.route_id && row.shape_id) {
          const routeId = parseInt(row.route_id.trim());
          const shapeId = parseInt(row.shape_id.replace(".0", "").trim());
  
          if (!routeToShapeMap[routeId]) {
            routeToShapeMap[routeId] = new Set(); // ✅ Use Set to avoid duplicates
          }
          routeToShapeMap[routeId].add(shapeId);
        }
      });
  
      // Convert Set to Array
      Object.keys(routeToShapeMap).forEach(routeId => {
        routeToShapeMap[routeId] = Array.from(routeToShapeMap[routeId]);
      });
  
      // Load shapes.txt
      const shapesResponse = await fetch("/gtfs/shapes.txt");
      const shapesText = await shapesResponse.text();
      const shapes = parseCSV(shapesText);
  
      // ✅ Group shape points by shape_id
      const shapeMap = {};
      shapes.forEach(row => {
        const { shape_id, shape_pt_lat, shape_pt_lon } = row;
        const cleanedShapeId = parseInt(shape_id.replace(".0", "").trim());
  
        if (!shapeMap[cleanedShapeId]) shapeMap[cleanedShapeId] = [];
        shapeMap[cleanedShapeId].push({ lat: parseFloat(shape_pt_lat), lng: parseFloat(shape_pt_lon) });
      });
  
      console.log("✅ GTFS Data Loaded Successfully");
      console.log("✅ Route to Shape Mapping:", routeToShapeMap);
      console.log("✅ Shape Map:", shapeMap);
  
      return { shapeMap, routeToShapeMap };
    } catch (error) {
      console.error("❌ Error loading GTFS data:", error);
    }
  }
  
  
  
  // ✅ Ensure parseCSV is exported if needed elsewhere
  export { parseCSV };
  
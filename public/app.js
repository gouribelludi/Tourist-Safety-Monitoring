// Simple helper functions
const qs = sel => document.querySelector(sel);
const status = txt => qs('#status').textContent = txt;

// Create map
const map = L.map('map').setView([20,0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// Icons
const policeIcon = L.icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Police_icon.svg/32px-Police_icon.svg.png',
  iconSize: [28,28],
  iconAnchor: [14,28]
});
const hospitalIcon = L.icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Red_Cross.svg/32px-Red_Cross.svg.png',
  iconSize: [28,28],
  iconAnchor: [14,28]
});

// Parse input: either "lat,lng" or address string
async function parseLocation(text) {
  text = (text||'').trim();
  if (!text) return null;
  // check if it's "lat,lng"
  const latlngMatch = text.match(/^\s*([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)\s*$/);
  if (latlngMatch) {
    return [parseFloat(latlngMatch[1]), parseFloat(latlngMatch[3])];
  }
  // otherwise geocode using Nominatim
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(text);
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }});
  if (!res.ok) throw new Error('Geocoding error: ' + res.status);
  const list = await res.json();
  if (!list || list.length === 0) throw new Error('Address not found: ' + text);
  return [parseFloat(list[0].lat), parseFloat(list[0].lon)];
}

async function geolocateBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(pos => {
      resolve([pos.coords.latitude, pos.coords.longitude]);
    }, err => reject(err.message || 'Geolocation failed'));
  });
}

// Build OSRM route (public demo server) and return GeoJSON LineString
async function getRoute(origin, dest) {
  // OSRM expects lon,lat pairs
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&annotations=duration,distance`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('OSRM routing error: ' + r.status);
  const j = await r.json();
  if (!j.routes || j.routes.length === 0) throw new Error('No route found');
  return j.routes[0].geometry; // GeoJSON LineString
}

// Query Overpass for police/hospital within bbox (south,west,north,east)
async function queryOverpass(bbox) {
  // bbox = [south, west, north, east]
  const [s,w,n,e] = bbox;
  const query = `
[out:json][timeout:25];
(
  node["amenity"~"hospital|police"](${s},${w},${n},${e});
  way["amenity"~"hospital|police"](${s},${w},${n},${e});
  relation["amenity"~"hospital|police"](${s},${w},${n},${e});
);
out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!res.ok) throw new Error('Overpass error: ' + res.status);
  return res.json();
}

// Convert Overpass result elements to array of {lat,lon,type,tags,id}
function elementsToPoints(elements) {
  const pts = [];
  for (const el of elements) {
    let lat, lon;
    if (el.type === 'node') {
      lat = el.lat; lon = el.lon;
    } else if (el.type === 'way' || el.type === 'relation') {
      // 'center' is provided by 'out center'
      if (el.center) { lat = el.center.lat; lon = el.center.lon; }
      else continue;
    } else continue;
    pts.push({
      id: el.id,
      type: el.type,
      lat, lon,
      tags: el.tags || {}
    });
  }
  return pts;
}

// Filter points to those within bufferMeters of the route (geojson LineString)
function filterPointsNearRoute(points, routeGeoJSON, bufferMeters) {
  const line = routeGeoJSON; // GeoJSON LineString
  const result = [];
  for (const p of points) {
    const pt = turf.point([p.lon, p.lat]);
    const distKm = turf.pointToLineDistance(pt, line, {units:'kilometers'});
    const distMeters = distKm * 1000;
    if (distMeters <= bufferMeters) {
      p.distanceToRoute = Math.round(distMeters);
      result.push(p);
    }
  }
  return result;
}

// Main function
async function showRouteAndAmenities() {
  status('Working...');
  clusterGroup.clearLayers();
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }

  let originInput = qs('#origin').value.trim();
  let destInput = qs('#destination').value.trim();
  let bufferMeters = Math.max(50, parseInt(qs('#buffer').value || '500', 10));

  let originCoords = null;
  let destCoords = null;

  try {
    // origin: if empty, attempt browser geolocation
    if (!originInput) {
      status('Using browser location...');
      originCoords = await geolocateBrowser(); // [lat,lon]
    } else {
      originCoords = await parseLocation(originInput);
    }
    destCoords = await parseLocation(destInput);
  } catch (err) {
    status('Error parsing locations: ' + (err.message || err));
    return;
  }

  status('Fetching route from OSRM...');
  let routeGeoJSON;
  try {
    routeGeoJSON = await getRoute(originCoords, destCoords); // GeoJSON LineString with coordinates [lon,lat]
  } catch (err) {
    status('Routing error: ' + (err.message || err));
    return;
  }

  // Draw route
  routeLayer = L.geoJSON(routeGeoJSON, {
    style: { color: '#007bff', weight: 5, opacity: 0.85 }
  }).addTo(map);

  // Fit map to route + origin/destination
  const routeBounds = routeLayer.getBounds();
  routeBounds.extend([originCoords[0], originCoords[1]]); // lat,lng
  routeBounds.extend([destCoords[0], destCoords[1]]);
  map.fitBounds(routeBounds, { padding: [50,50] });

  // compute bbox for Overpass query using turf bbox and expand a little
  const bboxArr = turf.bbox(routeGeoJSON); // [minX, minY, maxX, maxY] => [minLon, minLat, maxLon, maxLat]
  // convert to [south, west, north, east]
  let south = bboxArr[1], west = bboxArr[0], north = bboxArr[3], east = bboxArr[2];

  // Expand bbox by a small margin proportional to bufferMeters (approx meters to degrees)
  // 1 degree lat ~ 111km; 1 degree lon varies with latitude. We'll use approx conversion.
  const expandDegLat = (bufferMeters + 200) / 111000; // add 200m extra margin
  const midLat = (south + north) / 2;
  const expandDegLon = (bufferMeters + 200) / (111000 * Math.cos(midLat * Math.PI/180));
  south -= expandDegLat;
  north += expandDegLat;
  west -= expandDegLon;
  east += expandDegLon;

  status('Querying OSM for police & hospitals...');
  let overpassData;
  try {
    overpassData = await queryOverpass([south, west, north, east]);
  } catch (err) {
    status('Overpass error: ' + (err.message || err));
    return;
  }

  const points = elementsToPoints(overpassData.elements || []);
  status(`Found ${points.length} raw OSM items in bbox — filtering by ${bufferMeters} m to route...`);
  const nearby = filterPointsNearRoute(points, routeGeoJSON, bufferMeters);
  status(`Showing ${nearby.length} police/hospital items within ${bufferMeters} m of route.`);

  // Add origin/destination markers
  const origMarker = L.marker([originCoords[0], originCoords[1]]).bindPopup('Origin').addTo(map);
  const destMarker = L.marker([destCoords[0], destCoords[1]]).bindPopup('Destination').addTo(map);
  clusterGroup.addLayer(origMarker);
  clusterGroup.addLayer(destMarker);

  // Add POI markers
  for (const p of nearby) {
    const latlng = [p.lat, p.lon];
    const tagAmenity = (p.tags.amenity || '').toLowerCase();
    const name = p.tags.name || (tagAmenity === 'police' ? 'Police' : 'Hospital/Clinic');
    const popupHtml = `<b>${name}</b><br/>Type: ${tagAmenity || 'unknown'}<br/>Distance to route: ${p.distanceToRoute} m<br/>OSM id: ${p.id}`;
    const marker = L.marker(latlng, { icon: tagAmenity === 'police' ? policeIcon : hospitalIcon }).bindPopup(popupHtml);
    clusterGroup.addLayer(marker);
  }

  status(`Done — ${nearby.length} items placed. Zoom & click markers for details.`);
}

qs('#go').addEventListener('click', () => {
  showRouteAndAmenities().catch(e => {
    status('Unexpected error: ' + (e.message || e));
    console.error(e);
  });
});

qs('#clear').addEventListener('click', () => {
  clusterGroup.clearLayers();
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  qs('#origin').value = ''; qs('#destination').value = '';
  status('');
});

// Small usability helper: double-click map to set destination
map.on('dblclick', e => {
  const lat = e.latlng.lat.toFixed(6), lon = e.latlng.lng.toFixed(6);
  qs('#destination').value = `${lat},${lon}`;
  status(`Destination set to ${lat},${lon}`);
});

// initial instructions
status('Enter origin and destination (address or "lat,lng"). Double-click map to set destination coordinate. Click "Show route..." to begin.');
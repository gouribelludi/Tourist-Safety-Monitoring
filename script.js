// Initialize map centered on Mumbai
const map = L.map("map").setView([19.076, 72.8777], 12);

// Add OpenStreetMap tiles (no API key needed)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
}).addTo(map);

// Event listeners
document.getElementById('getLocation').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      document.getElementById('current').value = `${lat}, ${lng}`;
    });
  } else {
    alert('Geolocation is not supported by this browser.');
  }
});

document.getElementById('calculate').addEventListener('click', async () => {
  const current = document.getElementById('current').value;
  const dest = document.getElementById('destination').value;
  if (!current || !dest) {
    alert('Please enter both current location and destination.');
    return;
  }

  const currentCoords = await geocode(current);
  const destCoords = await geocode(dest);

  if (currentCoords && destCoords) {
    // Clear previous markers and routes
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Routing.Control) {
        map.removeLayer(layer);
      }
    });

    // Add routing
    L.Routing.control({
      waypoints: [
        L.latLng(currentCoords[0], currentCoords[1]),
        L.latLng(destCoords[0], destCoords[1])
      ],
      routeWhileDragging: false,
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    }).addTo(map);

    // Add nearby hospitals and police
    addNearby(currentCoords, 'hospital');
    addNearby(currentCoords, 'police');

    // Zoom to fit
    map.fitBounds([currentCoords, destCoords]);
  } else {
    alert('Could not geocode the locations. Please try again.');
  }
});

// Geocode function using Nominatim
async function geocode(query) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

// Add nearby places using Overpass API
async function addNearby(coords, type) {
  const query = type === 'hospital' ? 'amenity=hospital' : 'amenity=police';
  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=[out:json];node(around:500,${coords[0]},${coords[1]})[${query}];out;`);
    const data = await response.json();
    data.elements.forEach(element => {
      const lat = element.lat;
      const lng = element.lon;
      const name = element.tags.name || type;
      const iconUrl = type === 'hospital' 
        ? 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png'
        : 'https://cdn-icons-png.flaticon.com/512/201/201623.png';
      L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: iconUrl,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(map).bindPopup(`<b>${name}</b><br>${type.charAt(0).toUpperCase() + type.slice(1)}`);
    });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
  }
}
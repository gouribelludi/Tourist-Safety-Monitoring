const socket = io();
const map = L.map('map').setView([20, 78], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

const markers = {};

socket.on('locationUpdate', data => {
  const { userId, latitude, longitude } = data;
  if (markers[userId]) {
    markers[userId].setLatLng([latitude, longitude]);
  } else {
    markers[userId] = L.marker([latitude, longitude]).addTo(map)
      .bindPopup(`User: ${userId}`);
  }
});

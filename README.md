# Tourist Safety System 🛡️

A comprehensive web-based tourist safety system with GPS tracking, emergency route finding, and police/medical facility locator.

## Features

✨ **User Authentication**
- Secure login system
- Session management
- User-friendly interface

📍 **GPS Tracker**
- Real-time location tracking
- Auto-detection of current location
- Live position updates
- User information management

🚨 **Emergency Route Finder**
- Automatic current location detection
- Safe route planning with OSRM
- Shows nearby police stations and hospitals along the route
- Adjustable search radius
- Interactive map visualization

🏥 **Police & Medical Finder**
- Auto-detects your current location
- Shows nearby police stations
- Shows nearby hospitals and medical facilities
- Distance calculations
- Contact information display

🗺️ **Live Tracking Map**
- Admin dashboard for monitoring active trackers
- Real-time location updates
- Multiple user tracking
- Detailed user information

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Mapping**: Leaflet.js, OpenStreetMap
- **Routing**: OSRM (Open Source Routing Machine)
- **Data**: Overpass API for POI data
- **Geospatial**: Turf.js for calculations

## Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd "e:\Tourist_Safety\final\mini project4"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and go to:
   ```
   http://localhost:3000
   ```

## Usage

### Login
1. Open `http://localhost:3000`
2. Enter credentials:
   - **Username**: `tourist`
   - **Password**: `safe123`
   - (Or any username/password for demo)
3. Click "Login"

### Dashboard
After logging in, you'll see four main options:

1. **GPS Tracker** 📍
   - Click "Get My Current Location" to auto-detect your position
   - Fill in your details (name, phone, destination, email)
   - Click "Start Tracking" to begin monitoring
   - View live location updates

2. **Emergency Route Finder** 🚨
   - Your current location is auto-detected as origin
   - Enter your destination (address or coordinates)
   - Adjust search radius if needed
   - Click "Show Safe Route & Services"
   - View route with nearby police and hospitals

3. **Police & Medical Finder** 🏥
   - Click "Find My Location & Show All Services"
   - View all nearby police stations and hospitals
   - Filter by type (police only or hospitals only)
   - See distance and contact information

4. **Live Tracking Map** 🗺️
   - View all active GPS trackers on the map
   - Monitor real-time location updates
   - See user details and destinations

## Project Structure

```
mini project4/
├── index.html              # Login page (entry point)
├── dashboard.html          # Main dashboard after login
├── gps-tracker.html        # GPS tracking page
├── emergency-map.html      # Emergency route finder
├── police-medical.html     # Police & medical finder
├── admin-map.html          # Live tracking map
├── server.js               # Express server
├── package.json            # Dependencies
├── README.md               # This file
├── public/                 # Additional assets
├── views/                  # View templates
└── db.js                   # Database configuration (optional)
```

## API Endpoints

- `GET /` - Login page
- `GET /dashboard` - Dashboard page
- `GET /gps-tracker` - GPS tracker page
- `GET /emergency-map` - Emergency map page
- `GET /police-medical` - Police & medical finder page
- `GET /admin-map` - Admin tracking map page
- `POST /login` - Login endpoint
- `POST /logout` - Logout endpoint

## Features in Detail

### Auto Location Detection
All pages automatically detect your current location using the browser's Geolocation API. This provides:
- Accurate positioning
- No manual coordinate entry needed
- Real-time updates

### Interactive Maps
- Click markers for detailed information
- Double-click map to set destination
- Zoom and pan controls
- Clustering for better visualization

### Emergency Services
- Police stations within configurable radius
- Hospitals and medical facilities
- Distance calculations
- Route optimization

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

**Note**: Geolocation requires HTTPS in production or localhost for development.

## Development

For development with auto-restart:
```bash
npm run dev
```

## Security Notes

⚠️ This is a demo application. For production use:
- Implement proper authentication (bcrypt, JWT)
- Use HTTPS
- Add input validation
- Implement rate limiting
- Use environment variables for secrets
- Add CSRF protection

## License

ISC

## Support

For issues or questions, please check the code comments or contact the development team.

---

**Made with ❤️ for tourist safety**

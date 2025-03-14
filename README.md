### **BusFlow - Live Bus Tracking & Route Information**
**Real-time bus tracking application for Regina, SK, built with SvelteKit, Google Maps API, and GTFS data.**

<img width="1709" alt="Screenshot 2025-03-14 at 16 57 10" src="https://github.com/user-attachments/assets/81c6d297-2513-4f89-91a2-0e67ee022339" />

---

## ** Features**
-  **Real-Time Bus Tracking** – View live bus positions with smooth movement animations.
-  **Interactive Map** – Google Maps integration with route overlays and bus stop markers.
-  **Route Selection** – Filter buses by route and display corresponding bus stops.
-  **Dynamic UI Updates** – Bus icons update in real-time with accurate heading directions.
-  **Dark Mode Support** – Toggle between light and dark map styles.
-  **Bus Arrival Predictions** – Fetch estimated bus arrival times for selected stops.
-  **Customizable UI** – Uses high-contrast colors for better visibility.
-  **Modular Codebase** – Organized components for easy scalability.
-  **Vercel Deployment Ready** – Optimized for fast and efficient hosting.

---

## ** Tech Stack**
- **Frontend:** SvelteKit, Vite, TailwindCSS
- **Map Services:** Google Maps API
- **Data Source:** GTFS Data (General Transit Feed Specification)
- **Deployment:** Vercel
- **Backend API:** Custom API for live bus positions

---

## ** Installation & Setup**
### **1 Clone the Repository**
```bash
git clone https://github.com/Vishhyy/BusFlow-Vercel.git
cd BusFlow-Vercel
```

### **2 Install Dependencies**
```bash
npm install
```

### **3 Setup Environment Variables**
Create a `.env` file in the project root and add your API keys:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_API_URL=https://your-api-endpoint.com
VITE_GOOGLE_MAPS_ID=your_google_maps_id
```

### **4 Start Development Server**
```bash
npm run dev
```
Access the project at: **`http://localhost:5173`** _(default Vite port)_

---

## ** Deployment**
### **Deploy on Vercel**
```bash
vercel deploy
```
Alternatively, link it to GitHub and enable **Vercel’s Automatic Deployments**.

---

## ** How It Works**
### ** Live Bus Tracking**
- Fetches live bus locations from the API.
- Updates bus positions with smooth animations.
- Uses Google Maps' `AdvancedMarkerElement` for custom bus icons.

### ** Route & Stop Selection**
- Loads GTFS data to display available bus routes.
- Highlights the selected route and associated bus stops.
- Click a bus stop to see real-time arrival estimates.

### ** UI & Accessibility**
- **Dark Mode**: Toggle between light/dark map themes.
- **Route Colors**: High-contrast colors for each route.
- **Live Popups**: Informative popups for routes & stops.

---

## ** Customization**
Modify Google Maps styles in `darkModeStyles` and `lightModeStyles` in `src/lib/Map.svelte`:
```js
const darkModeStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
];
```

To change bus colors, update `getBusColor()` in `src/lib/processGTFS.js`:
```js
const routeColors = { "1": "#FF5733", "2": "#33FF57", "3": "#3357FF" };
```

---

## ** Contributing**
1. **Fork** the repo.
2. Create a **feature branch**:
   ```bash
   git checkout -b feature-name
   ```
3. **Commit changes**:
   ```bash
   git commit -m "Added new feature"
   ```
4. **Push to branch**:
   ```bash
   git push origin feature-name
   ```
5. **Submit a Pull Request!**

---

## ** License**
This project is licensed under the **MIT License**. Feel free to use and modify.

---

## ** Contact**
 **Questions? Suggestions?** Open an issue or reach out via GitHub!  
 **Email:** vsc521@uregina.ca
            vishwsheta@gmail.com

---


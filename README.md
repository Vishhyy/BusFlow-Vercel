### **\ud83d\udccc BusFlow - Live Bus Tracking & Route Information**
**Real-time bus tracking application for Regina, SK, built with SvelteKit, Google Maps API, and GTFS data.**

![BusFlow Preview](https://your-image-url.com) _(Replace with actual screenshot)_

---

## **\ud83d\ude80 Features**
- \ud83d\ude8c **Real-Time Bus Tracking** – View live bus positions with smooth movement animations.
- \ud83d\udccd **Interactive Map** – Google Maps integration with route overlays and bus stop markers.
- \ud83c\udfaf **Route Selection** – Filter buses by route and display corresponding bus stops.
- \ud83d\udd04 **Dynamic UI Updates** – Bus icons update in real-time with accurate heading directions.
- \ud83c\udf19 **Dark Mode Support** – Toggle between light and dark map styles.
- \ud83d\udd0d **Bus Arrival Predictions** – Fetch estimated bus arrival times for selected stops.
- \ud83c\udfa8 **Customizable UI** – Uses high-contrast colors for better visibility.
- \ud83d\udccc **Modular Codebase** – Organized components for easy scalability.
- \ud83d\ude80 **Vercel Deployment Ready** – Optimized for fast and efficient hosting.

---

## **\ud83d\udee0\ufe0f Tech Stack**
- **Frontend:** SvelteKit, Vite, TailwindCSS
- **Map Services:** Google Maps API
- **Data Source:** GTFS Data (General Transit Feed Specification)
- **Deployment:** Vercel
- **Backend API:** Custom API for live bus positions

---

## **\ud83d\udecb\ufe0f Installation & Setup**
### **1\ufe0f\u20e3 Clone the Repository**
```bash
git clone https://github.com/Vishhyy/BusFlow-Vercel.git
cd BusFlow-Vercel
```

### **2\ufe0f\u20e3 Install Dependencies**
```bash
npm install
```

### **3\ufe0f\u20e3 Setup Environment Variables**
Create a `.env` file in the project root and add your API keys:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_API_URL=https://your-api-endpoint.com
```

### **4\ufe0f\u20e3 Start Development Server**
```bash
npm run dev
```
Access the project at: **`http://localhost:5173`** _(default Vite port)_

---

## **\ud83d\ude80 Deployment**
### **Deploy on Vercel**
```bash
vercel deploy
```
Alternatively, link it to GitHub and enable **Vercel’s Automatic Deployments**.

---

## **\ud83d\uddcf\ufe0f How It Works**
### **\ud83d\ude8c Live Bus Tracking**
- Fetches live bus locations from the API.
- Updates bus positions with smooth animations.
- Uses Google Maps' `AdvancedMarkerElement` for custom bus icons.

### **\ud83d\udccd Route & Stop Selection**
- Loads GTFS data to display available bus routes.
- Highlights the selected route and associated bus stops.
- Click a bus stop to see real-time arrival estimates.

### **\ud83c\udfa8 UI & Accessibility**
- **Dark Mode**: Toggle between light/dark map themes.
- **Route Colors**: High-contrast colors for each route.
- **Live Popups**: Informative popups for routes & stops.

---

## **\ud83d\udee0\ufe0f Customization**
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

## **\ud83d\udc4c Contributing**
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

## **\ud83d\udcdc License**
This project is licensed under the **MIT License**. Feel free to use and modify.

---

## **\ud83d\udce9 Contact**
\ud83d\udca1 **Questions? Suggestions?** Open an issue or reach out via GitHub!  
\ud83d\udce7 **Email:** your-email@example.com _(Replace with actual contact)_

---


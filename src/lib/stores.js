// src/lib/stores.js
import { writable } from 'svelte/store';

// Google Maps instances
export const mapInstance = writable(null);
export const googleInstance = writable(null);
export const isMapReady = writable(false); // <-- ADD THIS FLAG

// UI State
export const isDarkMode = writable(false);
export const isBusListPopupOpen = writable(false);
export const selectedStop = writable(null);

// Data Stores
export const gtfsData = writable({ /* ... initial data ... */ });
export const liveBusData = writable([]);
export const activeRoutePolylines = writable({});
export const visibleStopOverlays = writable([]);
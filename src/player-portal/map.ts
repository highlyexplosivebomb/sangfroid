/// <reference types="google.maps" />
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let map: google.maps.Map | null = null;
let loaderPromise: Promise<void> | null = null;
let watchId: number | null = null;
let userMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let hasInitialPan = false;

export async function initGameMap(containerId: string): Promise<void> {
  if (map) {
    return;
  }

  const el = document.getElementById(containerId);
  if (!el) {
    return;
  }

  if (!loaderPromise) {
    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      v: 'weekly',
    });

    loaderPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('marker')
    ]).then(() => { });
  }

  await loaderPromise;

  map = new google.maps.Map(el, {
    center: { lat: -33.8688, lng: 151.2093 },
    zoom: 15,
    disableDefaultUI: true,
    zoomControl: true,
    mapId: 'SANGFROID_MAIN_MAP',
    gestureHandling: 'greedy',
  });

  const n = -33.853;
  const s = -33.887;
  const w = 151.191;
  const e = 151.218;

  const maskOptions = {
    strokeWeight: 0,
    fillColor: '#b91c1c',
    fillOpacity: 0.35,
    clickable: false,
    map: map,
  };

  const N_outer = -10;
  const S_outer = -60;
  const W_outer = 110;
  const E_outer = 170;

  // Top mask
  new google.maps.Rectangle({
    ...maskOptions,
    bounds: { north: N_outer, south: n, east: E_outer, west: W_outer }
  });

  // Bottom mask
  new google.maps.Rectangle({
    ...maskOptions,
    bounds: { north: s, south: S_outer, east: E_outer, west: W_outer }
  });

  // Left mask
  new google.maps.Rectangle({
    ...maskOptions,
    bounds: { north: n, south: s, east: w, west: W_outer }
  });

  // Right mask
  new google.maps.Rectangle({
    ...maskOptions,
    bounds: { north: n, south: s, east: E_outer, west: e }
  });

  // Inner border
  new google.maps.Polyline({
    path: [
      { lat: n, lng: w },
      { lat: n, lng: e },
      { lat: s, lng: e },
      { lat: s, lng: w },
      { lat: n, lng: w }
    ],
    strokeColor: '#b91c1c',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    map: map,
    clickable: false,
  });

  const locationButton = document.createElement("button");
  locationButton.className = "icon-btn map-locate-btn";
  locationButton.style.margin = "10px";
  locationButton.style.padding = "8px";
  locationButton.style.backgroundColor = "#0f172a";
  locationButton.style.color = "white";
  locationButton.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
  locationButton.style.border = "1px solid rgba(255,255,255,0.1)";
  locationButton.style.borderRadius = "4px";
  locationButton.style.cursor = "pointer";
  locationButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;

  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(locationButton);

  locationButton.addEventListener("click", () => {
    if (navigator.geolocation) {
      if (watchId === null) {
        hasInitialPan = false;
        locationButton.style.color = "#3b82f6";
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            if (!userMarker) {
              const dot = document.createElement('div');
              dot.style.width = '14px';
              dot.style.height = '14px';
              dot.style.backgroundColor = '#2563eb';
              dot.style.borderRadius = '50%';
              dot.style.border = '2px solid white';
              dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';

              userMarker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: pos,
                title: "Your Location",
                content: dot,
              });
            } else {
              userMarker.position = pos;
            }

            if (!hasInitialPan) {
              map?.panTo(pos);
              map?.setZoom(17);
              hasInitialPan = true;
            }
          },
          (err) => {
            console.error(err);
            alert("Error: The Geolocation service failed or was denied.");
            locationButton.style.color = "white";
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      } else {
        if (userMarker?.position) {
          map?.panTo(userMarker.position as google.maps.LatLngLiteral);
        }
      }
    } else {
      alert("Error: Your browser doesn't support geolocation.");
    }
  });
}

export function destroyGameMap(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (userMarker) {
    userMarker.map = null;
    userMarker = null;
  }
  map = null;
  hasInitialPan = false;
}

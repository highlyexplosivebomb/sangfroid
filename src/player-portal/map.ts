import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let map: L.Map | null = null;

export function initGameMap(containerId: string): void {
  if (map) {
    return;
  }

  const el = document.getElementById(containerId);
  if (!el) {
    return;
  }

  map = L.map(containerId, {
    center: [-33.8688, 151.2093],
    zoom: 15,
    zoomControl: false,
    attributionControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);

  const playAreaBounds: L.LatLngTuple[] = [
    [-33.856, 151.200],
    [-33.856, 151.217],
    [-33.880, 151.217],
    [-33.880, 151.200],
  ];

  const worldBounds: L.LatLngTuple[] = [
    [90, -180],
    [90, 180],
    [-90, 180],
    [-90, -180],
  ];

  if (!document.getElementById('out-of-bounds-pattern')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.position = 'absolute';
    svg.id = 'out-of-bounds-pattern';
    svg.innerHTML = `
      <defs>
        <pattern id="diagonal-stripes" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#b91c1c" stroke-width="3" opacity="0.6" />
        </pattern>
      </defs>
    `;
    document.body.appendChild(svg);
  }

  L.polygon([worldBounds, playAreaBounds], {
    color: '#b91c1c',
    weight: 3,
    fillColor: 'url(#diagonal-stripes)',
    fillOpacity: 1,
    interactive: false,
  }).addTo(map);

  setTimeout(() => {
    map?.invalidateSize();
  }, 200);
}

export function destroyGameMap(): void {
  if (map) {
    map.remove();
    map = null;
  }
}

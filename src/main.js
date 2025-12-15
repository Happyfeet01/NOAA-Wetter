import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import debounce from 'lodash.debounce';
import { MAP_CONFIG } from './config';
import { initRadarLayer } from './layers/radar';
import { initCloudLayer } from './layers/clouds';
import { initWindLayer } from './layers/windflow';
import { initWarnings } from './layers/warnings';
import { initSidebar } from './layers/sidebar';
import { initInfoBox } from './layers/infobox';

const debugEl = document.getElementById('debug');
const logDebug = (msg) => {
  const ts = new Date().toISOString();
  const line = document.createElement('div');
  line.textContent = `[${ts}] ${msg}`;
  debugEl?.appendChild(line);
  if (debugEl?.childElementCount > 8) debugEl.removeChild(debugEl.firstChild);
};

const map = L.map('map', {
  center: MAP_CONFIG.center,
  zoom: MAP_CONFIG.zoom,
  minZoom: MAP_CONFIG.minZoom,
  maxZoom: MAP_CONFIG.maxZoom
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const sidebar = initSidebar();
const cloudSlider = document.getElementById('cloud-slider');
const radarSlider = document.getElementById('radar-slider');
const windSlider = document.getElementById('wind-slider');
const warnSlider = document.getElementById('warn-slider');
const warningBanner = document.getElementById('warning-banner');
const locateBtn = document.getElementById('locate-btn');

const warningCounts = { dwd: 0, nina: 0 };
const updateBanner = () => {
  const total = warningCounts.dwd + warningCounts.nina;
  if (total > 0) {
    warningBanner.style.display = 'block';
    warningBanner.textContent = `⚠️ ${total} aktive Warnungen (DWD: ${warningCounts.dwd}, BBK/NINA: ${warningCounts.nina})`;
  } else {
    warningBanner.style.display = 'none';
    warningBanner.textContent = '';
  }
};

(async () => {
  const radar = await initRadarLayer(map, logDebug, parseFloat(radarSlider?.value || '0.7'));
  const clouds = await initCloudLayer(map, cloudSlider, logDebug);
  const wind = await initWindLayer(map, logDebug);
  const warnings = await initWarnings(map, sidebar, logDebug, (summary) => {
    if (summary?.source) {
      warningCounts[summary.source] = summary.count ?? 0;
      updateBanner();
    }
  });
  const infoBox = initInfoBox(map, logDebug);

  radarSlider?.addEventListener('input', (ev) => radar?.setOpacity?.(ev.target.value));
  cloudSlider?.addEventListener('input', (ev) => clouds?.setOpacity?.(ev.target.value));
  windSlider?.addEventListener('input', (ev) => wind?.setOpacity?.(ev.target.value));
  warnSlider?.addEventListener('input', (ev) => warnings?.setOpacity?.(ev.target.value));
  warnings?.setOpacity?.(warnSlider?.value ?? 0.8);

  const doLocate = () => {
    if (!navigator.geolocation) {
      alert('Geolokalisierung nicht verfügbar');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latlng = L.latLng(latitude, longitude);
        map.setView(latlng, Math.max(map.getZoom(), 8));
        infoBox?.update(latlng);
      },
      () => {
        alert('Standort konnte nicht bestimmt werden');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };
  locateBtn?.addEventListener('click', doLocate);
})();

// Debounced resize to keep Leaflet canvas in sync
window.addEventListener(
  'resize',
  debounce(() => {
    map.invalidateSize();
  }, 150)
);

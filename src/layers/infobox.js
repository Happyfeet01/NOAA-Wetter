import debounce from 'lodash.debounce';
import { ENDPOINTS } from '../config';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

async function fetchTemperature(lat, lon) {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const url = `${ENDPOINTS.openMeteo}?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo status ${resp.status}`);
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Open-Meteo content-type ${contentType}`);
  }
  const data = await resp.json();
  const temp = data?.current?.temperature_2m;
  cache.set(key, { value: temp, timestamp: Date.now() });
  return temp;
}

export function initInfoBox(map, debugLogger) {
  const box = document.getElementById('info-box');

  const updateBox = async (latlng) => {
    const { lat, lng } = latlng;
    box.innerHTML = `Lat ${lat.toFixed(3)}, Lon ${lng.toFixed(3)} — Laden...`;
    try {
      const temp = await fetchTemperature(lat, lng);
      box.innerHTML = `Lat ${lat.toFixed(3)}, Lon ${lng.toFixed(3)}<br/>Temperatur: ${temp ?? 'n/a'} °C`;
    } catch (err) {
      box.innerHTML = `Lat ${lat.toFixed(3)}, Lon ${lng.toFixed(3)}<br/>Temp Fehler`;
      debugLogger?.(`InfoBox error: ${err.message}`);
    }
  };

  const debounced = debounce(() => updateBox(map.getCenter()), 250);
  map.on('moveend', debounced);
  map.on('click', (ev) => updateBox(ev.latlng));

  updateBox(map.getCenter());
  return {
    update: updateBox
  };
}

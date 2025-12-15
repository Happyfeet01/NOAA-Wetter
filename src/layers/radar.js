import { ENDPOINTS } from '../config';
import L from 'leaflet';

const RAINVIEWER_TILE = (id) =>
  `https://tilecache.rainviewer.com/v2/radar/${id}/512/{z}/{x}/{y}/2/1_1.png`;

export async function initRadarLayer(map, debugLogger, initialOpacity = 0.7) {
  try {
    const resp = await fetch(ENDPOINTS.rainviewer);
    if (!resp.ok) throw new Error(`RainViewer status ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`RainViewer content-type ${contentType}`);
    }
    const json = await resp.json();
    const lastPastFrame = json?.radar?.past?.[json.radar.past.length - 1];
    if (!lastPastFrame?.path) throw new Error('No RainViewer frames');

    const layer = L.tileLayer(RAINVIEWER_TILE(lastPastFrame.path), {
      opacity: initialOpacity,
      attribution: 'RainViewer'
    });
    layer.addTo(map);
    debugLogger?.(`RainViewer frame ${lastPastFrame.time}`);
    return {
      layer,
      setOpacity: (value) => {
        if (layer && typeof layer.setOpacity === 'function') {
          layer.setOpacity(parseFloat(value));
        }
      }
    };
  } catch (err) {
    console.error('RainViewer init failed', err);
    debugLogger?.(`RainViewer error: ${err.message}`);
    return null;
  }
}

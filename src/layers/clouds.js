import L from 'leaflet';
import { CLOUD_COLOR_SCALE } from '../config';

function interpolateColor(scale, value) {
  const sorted = [...scale].sort((a, b) => a.pct - b.pct);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (value >= a.pct && value <= b.pct) {
      const t = (value - a.pct) / (b.pct - a.pct);
      return a.color.map((c, idx) => Math.round(c + (b.color[idx] - c) * t));
    }
  }
  return sorted[sorted.length - 1].color;
}

function buildCanvasOverlay(grid) {
  const { nx, ny, dx, dy, lo1, la1 } = grid.header;
  const canvas = document.createElement('canvas');
  canvas.width = nx;
  canvas.height = ny;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(nx, ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const val = grid.data[idx];
      const color = interpolateColor(CLOUD_COLOR_SCALE, val ?? 0);
      imgData.data[idx * 4 + 0] = color[0];
      imgData.data[idx * 4 + 1] = color[1];
      imgData.data[idx * 4 + 2] = color[2];
      imgData.data[idx * 4 + 3] = color[3];
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const west = lo1;
  const north = la1;
  const east = lo1 + dx * nx;
  const south = la1 - dy * ny;
  const bounds = L.latLngBounds([south, west], [north, east]);

  const overlay = L.imageOverlay(canvas.toDataURL('image/png'), bounds, {
    opacity: 0.6,
    interactive: false
  });
  return overlay;
}

export async function initCloudLayer(map, opacitySlider, debugLogger) {
  try {
    const resp = await fetch('/data/clouds.json');
    if (!resp.ok) throw new Error(`Cloud data status ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Cloud data content-type ${contentType}`);
    }
    const json = await resp.json();
    if (!json?.grid?.header || !Array.isArray(json.grid.data)) {
      throw new Error('Cloud JSON missing grid');
    }

    let overlay = buildCanvasOverlay(json.grid);
    overlay.addTo(map);

    const updateOpacity = (value) => {
      if (overlay && overlay.setOpacity) {
        overlay.setOpacity(parseFloat(value));
      }
    };

    opacitySlider?.addEventListener('input', (ev) => updateOpacity(ev.target.value));
    updateOpacity(opacitySlider?.value ?? 0.6);

    debugLogger?.(`Clouds generated ${json.meta?.generated || 'n/a'}`);
    return {
      overlay,
      setOpacity: updateOpacity,
      refresh: (nextJson) => {
        if (overlay) {
          map.removeLayer(overlay);
        }
        overlay = buildCanvasOverlay(nextJson.grid);
        overlay.addTo(map);
        updateOpacity(opacitySlider?.value ?? 0.6);
      }
    };
  } catch (err) {
    console.error('Cloud layer failed', err);
    debugLogger?.(`Clouds error: ${err.message}`);
    return null;
  }
}

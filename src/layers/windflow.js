import L from 'leaflet';
import 'leaflet-velocity';
import debounce from 'lodash.debounce';

const PADDING_DEG = 5;

function cropField(component, bounds) {
  const { header, data } = component;
  const { lo1, la1, dx, dy, nx, ny } = header;
  const west = Math.max(bounds.getWest() - PADDING_DEG, -180);
  const east = Math.min(bounds.getEast() + PADDING_DEG, 180);
  const north = Math.min(bounds.getNorth() + PADDING_DEG, la1);
  const south = Math.max(bounds.getSouth() - PADDING_DEG, la1 - dy * (ny - 1));

  const iStart = Math.max(0, Math.floor((west - lo1) / dx));
  const iEnd = Math.min(nx - 1, Math.ceil((east - lo1) / dx));
  const jStart = Math.max(0, Math.floor((la1 - north) / dy));
  const jEnd = Math.min(ny - 1, Math.ceil((la1 - south) / dy));

  const croppedNx = iEnd - iStart + 1;
  const croppedNy = jEnd - jStart + 1;
  const subset = new Array(croppedNx * croppedNy);

  for (let j = jStart; j <= jEnd; j++) {
    for (let i = iStart; i <= iEnd; i++) {
      const srcIdx = j * nx + i;
      const dstIdx = (j - jStart) * croppedNx + (i - iStart);
      subset[dstIdx] = data[srcIdx];
    }
  }

  const newHeader = {
    ...header,
    lo1: lo1 + iStart * dx,
    la1: la1 - jStart * dy,
    nx: croppedNx,
    ny: croppedNy
  };

  return { header: newHeader, data: subset };
}

function buildVelocityLayer(globalData, bounds) {
  const cropped = globalData.data.map((component) => cropField(component, bounds));
  return L.velocityLayer({
    data: cropped,
    displayValues: true,
    velocityScale: 0.005,
    maxVelocity: globalData.meta?.stats?.maxVelocity || 30,
    particleAge: 60,
    frameRate: 20,
    lineWidth: 1,
    opacity: 0.8
  });
}

export async function initWindLayer(map, debugLogger) {
  try {
    const resp = await fetch('/data/wind-global.json');
    if (!resp.ok) throw new Error(`Wind status ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Wind content-type ${contentType}`);
    }
    const json = await resp.json();
    if (!Array.isArray(json.data) || json.data.length < 2) {
      throw new Error('Wind JSON missing components');
    }

    let velocityLayer = buildVelocityLayer(json, map.getBounds());
    velocityLayer.addTo(map);
    debugLogger?.(`Wind generated ${json.meta?.generated || 'n/a'}`);

    const rebuild = debounce(() => {
      const next = buildVelocityLayer(json, map.getBounds());
      if (velocityLayer) {
        map.removeLayer(velocityLayer);
      }
      velocityLayer = next;
      velocityLayer.addTo(map);
    }, 400);

    map.on('moveend zoomend', rebuild);

    return {
      layer: () => velocityLayer,
      setOpacity: (value) => {
        if (velocityLayer && velocityLayer.setOpacity && velocityLayer._windy?.canvas) {
          velocityLayer.setOpacity(parseFloat(value));
        }
      }
    };
  } catch (err) {
    console.error('Wind layer failed', err);
    debugLogger?.(`Wind error: ${err.message}`);
    return null;
  }
}

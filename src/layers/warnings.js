import L from 'leaflet';
import dayjs from 'dayjs';
import { ENDPOINTS, WARNING_COLORS } from '../config';

function severityColor(level) {
  return WARNING_COLORS[level] || WARNING_COLORS[1];
}

function mapSeverity(value) {
  if (!value) return 1;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return Math.min(Math.max(Math.round(numeric), 1), 4);
  const lookup = {
    minor: 1,
    moderate: 2,
    severe: 3,
    extreme: 4
  };
  const key = String(value).toLowerCase();
  return lookup[key] || 1;
}

function formatValidity(feature) {
  const start = feature?.properties?.onset || feature?.properties?.start;
  const end = feature?.properties?.expires || feature?.properties?.end;
  const format = (v) => (v ? dayjs(v).format('DD.MM HH:mm') : '');
  if (!start && !end) return '';
  return `${format(start)} - ${format(end)}`;
}

export async function initWarnings(map, sidebar, debugLogger, onSummary) {
  let currentOpacity = 0.8;

  const dwdLayer = L.geoJSON(null, {
    style: (feature) => {
      const level = mapSeverity(feature?.properties?.EX_LEVEL || feature?.properties?.LEVEL);
      return {
        color: severityColor(level),
        weight: 2,
        fillOpacity: 0.25 * currentOpacity,
        opacity: currentOpacity
      };
    },
    onEachFeature: (feature, layer) => {
      const level = mapSeverity(feature?.properties?.EX_LEVEL || feature?.properties?.LEVEL);
      const title = feature.properties?.EVENT || feature.properties?.event || 'DWD Warnung';
      const body = feature.properties?.DESCRIPTION || feature.properties?.description || '';
      const validity = formatValidity(feature);
      const html = `<strong>${title}</strong><br/>${validity}<br/>${body}`;
      layer.bindPopup(html);
      layer.on('click', () => layer.openPopup());
    }
  }).addTo(map);

  async function loadDwd() {
    try {
      const resp = await fetch(ENDPOINTS.dwdWfs);
      if (!resp.ok) throw new Error(`DWD status ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`DWD content-type ${contentType}`);
      }
      const geojson = await resp.json();
      dwdLayer.clearLayers();
      dwdLayer.addData(geojson);

      const cards = (geojson.features || []).map((feature) => {
        const level = mapSeverity(feature.properties?.EX_LEVEL || feature.properties?.LEVEL);
        return {
          title: feature.properties?.EVENT || feature.properties?.event || 'DWD Warnung',
          description: feature.properties?.DESCRIPTION || feature.properties?.description || '',
          validity: formatValidity(feature),
          level,
          color: severityColor(level)
        };
      });
      sidebar.updateWarnings('dwd', cards);
      onSummary?.({ source: 'dwd', count: cards.length });
      debugLogger?.(`DWD warnings ${cards.length}`);
    } catch (err) {
      console.error('DWD fetch failed', err);
      debugLogger?.(`DWD error: ${err.message}`);
      sidebar.updateWarnings('dwd', []);
      onSummary?.({ source: 'dwd', count: 0 });
    }
  }

  async function loadNina() {
    const url = `${ENDPOINTS.ninaBase}appdata/geojson/all.json`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`NINA status ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`NINA content-type ${contentType}`);
      }
      const data = await resp.json();
      const features = data.features || [];
      const cards = features.map((f) => {
        const level = mapSeverity(f.properties?.severity || f.properties?.SERL);
        return {
          title: f.properties?.headline || f.properties?.name || 'NINA Warnung',
          description: f.properties?.description || f.properties?.instruction || '',
          validity: formatValidity(f),
          level,
          color: severityColor(level)
        };
      });
      sidebar.updateWarnings('nina', cards);
      onSummary?.({ source: 'nina', count: cards.length });
      debugLogger?.(`NINA warnings ${cards.length}`);
    } catch (err) {
      console.error('NINA fetch failed', err);
      debugLogger?.(`NINA error: ${err.message}`);
      sidebar.updateWarnings('nina', []);
      onSummary?.({ source: 'nina', count: 0 });
    }
  }

  loadDwd();
  loadNina();

  return {
    setOpacity: (value) => {
      currentOpacity = parseFloat(value);
      dwdLayer.setStyle((feature) => {
        const level = mapSeverity(feature?.properties?.EX_LEVEL || feature?.properties?.LEVEL);
        return {
          color: severityColor(level),
          weight: 2,
          fillOpacity: 0.25 * currentOpacity,
          opacity: currentOpacity
        };
      });
    }
  };
}

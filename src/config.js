export const MAP_CONFIG = {
  center: [51.0, 10.0],
  zoom: 5,
  minZoom: 2,
  maxZoom: 12
};

export const ENDPOINTS = {
  rainviewer: 'https://api.rainviewer.com/public/weather-maps.json',
  dwdWfs:
    'https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=dwd:Warnungen_Gemeinden&outputFormat=application/json',
  ninaBase: '/nina/api31/',
  openMeteo: 'https://api.open-meteo.com/v1/forecast'
};

export const WARNING_COLORS = {
  1: 'var(--warn-yellow)',
  2: 'var(--warn-orange)',
  3: 'var(--warn-red)',
  4: 'var(--warn-purple)'
};

export const CLOUD_COLOR_SCALE = [
  { pct: 0, color: [0, 0, 0, 0] },
  { pct: 20, color: [200, 200, 200, 60] },
  { pct: 50, color: [220, 220, 220, 120] },
  { pct: 80, color: [255, 255, 255, 180] },
  { pct: 100, color: [255, 255, 255, 220] }
];

#!/usr/bin/env python3
"""Fetch Open-Meteo cloud cover grid and write as JSON."""
import argparse
import datetime as dt
import json
import pathlib
import tempfile
import time
from typing import List, Tuple

import requests

API = "https://api.open-meteo.com/v1/gfs"


def chunked(seq, size):
  for i in range(0, len(seq), size):
    yield seq[i:i + size]


def fetch_batch(points: List[Tuple[float, float]]):
  latitudes = ",".join(f"{p[0]:.2f}" for p in points)
  longitudes = ",".join(f"{p[1]:.2f}" for p in points)
  params = {
    "latitude": latitudes,
    "longitude": longitudes,
    "current": "cloud_cover",
    "timezone": "UTC",
  }
  resp = requests.get(API, params=params, timeout=40)
  resp.raise_for_status()
  ctype = resp.headers.get("content-type", "")
  if "application/json" not in ctype:
    raise RuntimeError(f"Cloud API content-type {ctype}")
  payload = resp.json()

  datasets = payload if isinstance(payload, list) else [payload]
  results = []
  for item in datasets:
    currents = item.get("current") or item.get("current_weather")
    if isinstance(currents, dict) and "cloud_cover" in currents:
      results.append(currents.get("cloud_cover"))
    elif isinstance(currents, list):
      results.extend(c.get("cloud_cover") for c in currents)
    else:
      results.append(None)

  if len(results) == 1 and len(points) > 1:
    results = results * len(points)
  if len(results) != len(points):
    raise RuntimeError(f"Unexpected Open-Meteo response shape (got {len(results)} values for {len(points)} points)")
  return results


def build_grid(step):
  lats = [round(x, 2) for x in list(frange(-88, 88 + step, step))]
  lons = [round(x, 2) for x in list(frange(-178, 180, step))]
  nx = len(lons)
  ny = len(lats)
  values = [0.0] * (nx * ny)
  lat_lookup = {v: i for i, v in enumerate(lats)}
  lon_lookup = {v: i for i, v in enumerate(lons)}

  for batch in chunked([(lat, lon) for lat in lats for lon in lons], 8):
    results = fetch_batch(batch)
    for (lat, lon), val in zip(batch, results):
      j = lat_lookup[lat]
      i = lon_lookup[lon]
      values[j * nx + i] = float(val) if val is not None else 0.0
    time.sleep(0.1)

  header = {
    "lo1": lons[0],
    "la1": lats[0],
    "dx": step,
    "dy": step,
    "nx": nx,
    "ny": ny,
  }
  return header, values


def frange(start, stop, step):
  while start <= stop + 1e-6:
    yield start
    start += step


def write_atomic(target: pathlib.Path, payload: dict):
  target.parent.mkdir(parents=True, exist_ok=True)
  with tempfile.NamedTemporaryFile("w", delete=False, dir=target.parent) as tmp:
    json.dump(payload, tmp)
    tmp.flush()
    pathlib.Path(tmp.name).rename(target)


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", default="public/data/clouds.json")
  parser.add_argument("--step", type=float, default=2.0, help="Grid step in degrees")
  args = parser.parse_args()

  header, values = build_grid(args.step)
  payload = {
    "meta": {"generated": dt.datetime.utcnow().isoformat() + "Z", "step": args.step},
    "grid": {"header": header, "data": values},
  }
  write_atomic(pathlib.Path(args.out), payload)
  print(f"Wrote {args.out}")


if __name__ == "__main__":
  main()

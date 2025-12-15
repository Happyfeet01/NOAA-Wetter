#!/usr/bin/env python3
"""Fetch NOAA GFS 10 m wind and convert to leaflet-velocity JSON."""
import argparse
import datetime as dt
import json
import pathlib
import tempfile

import numpy as np
import requests
from herbie import Herbie


def latest_herbie_run(max_back=6):
  now = dt.datetime.now(dt.UTC).replace(minute=0, second=0, microsecond=0)
  base_hour = now.hour - (now.hour % 6)
  start = now.replace(hour=base_hour)
  last_error = None

  for step in range(max_back):
    run_time = start - dt.timedelta(hours=6 * step)
    run_time_naive = run_time.replace(tzinfo=None)
    h = Herbie(run_time_naive, model="gfs", product="pgrb2.1p00", fxx=0)
    try:
      validate_head(str(h.grib))
      return h
    except Exception as exc:  # noqa: BLE001 - bubble up last error
      last_error = exc
      continue

  raise RuntimeError(f"No recent GFS run found ({max_back} cycles checked): {last_error}")


def validate_head(url: str):
  resp = requests.head(url, timeout=30, allow_redirects=True)
  resp.raise_for_status()
  ctype = resp.headers.get("content-type", "")
  if "grib" not in ctype and "octet-stream" not in ctype:
    raise RuntimeError(f"Unexpected GRIB content-type: {ctype}")


def to_velocity_component(ds, var_name):
  lat = np.array(ds.latitude)
  lon = np.array(ds.longitude)

  lon = (lon + 180) % 360 - 180
  arr = np.array(ds[var_name])

  lon_order = np.argsort(lon)
  lon_sorted = lon[lon_order]
  arr = arr[..., lon_order]

  if lat[1] > lat[0]:
    lat = lat[::-1]
    arr = arr[::-1, :]

  dy = abs(float(lat[1] - lat[0]))
  dx = abs(float(lon_sorted[1] - lon_sorted[0]))

  header = {
    "parameterCategory": 2,
    "parameterNumber": 2 if "UGRD" in var_name else 3,
    "refTime": ds.time.dt.strftime("%Y-%m-%dT%H:%M:%SZ").item(),
    "lo1": float(lon_sorted[0]),
    "la1": float(lat[0]),
    "dx": dx,
    "dy": dy,
    "nx": int(len(lon_sorted)),
    "ny": int(len(lat)),
    "parameterUnit": "m/s",
    "scanMode": 0,
  }

  data = arr.astype(float).reshape(-1).tolist()
  return {"header": header, "data": data}


def compute_stats(u, v):
  u_arr = np.array(u["data"], dtype=float)
  v_arr = np.array(v["data"], dtype=float)
  speed = np.sqrt(u_arr ** 2 + v_arr ** 2)
  return {
    "maxVelocity": float(np.nanmax(speed)),
    "avgVelocity": float(np.nanmean(speed)),
  }


def write_atomic(target: pathlib.Path, payload: dict):
  target.parent.mkdir(parents=True, exist_ok=True)
  with tempfile.NamedTemporaryFile("w", delete=False, dir=target.parent) as tmp:
    json.dump(payload, tmp)
    tmp.flush()
    pathlib.Path(tmp.name).rename(target)


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", default="public/data/wind-global.json", help="Output JSON path")
  args = parser.parse_args()

  h = latest_herbie_run()
  ds = h.xarray(var=["UGRD:10 m above ground", "VGRD:10 m above ground"], remove_grib=False)

  u_var = [k for k in ds.data_vars if "UGRD" in k][0]
  v_var = [k for k in ds.data_vars if "VGRD" in k][0]
  u = to_velocity_component(ds, u_var)
  v = to_velocity_component(ds, v_var)
  stats = compute_stats(u, v)

  payload = {
    "meta": {
      "generated": dt.datetime.now(dt.UTC).isoformat().replace("+00:00", "Z"),
      "source": "NOAA GFS 1.0deg",
      "refTime": u["header"]["refTime"],
      "bounds": {"west": -180, "east": 180, "south": -85, "north": 85},
      "grid": {"nx": u["header"]["nx"], "ny": u["header"]["ny"], "dx": u["header"]["dx"], "dy": u["header"]["dy"]},
      "stats": stats,
    },
    "data": [u, v],
  }

  if len(u["data"]) != u["header"]["nx"] * u["header"]["ny"]:
    raise RuntimeError("U component size mismatch")
  if len(v["data"]) != v["header"]["nx"] * v["header"]["ny"]:
    raise RuntimeError("V component size mismatch")

  write_atomic(pathlib.Path(args.out), payload)
  print(f"Wrote {args.out}")


if __name__ == "__main__":
  main()

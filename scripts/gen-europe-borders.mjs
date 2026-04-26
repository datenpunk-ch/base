import fs from "node:fs";

const gj = JSON.parse(fs.readFileSync("tmp_ne_110m_admin0.geojson", "utf8"));

// Match the SVG map viewport in about.html (inside translate(60 40))
const lonMin = -8;
const lonMax = 15;
const latMin = 46;
const latMax = 57;
const W = 780;
const H = 460;

const proj = (lon, lat) => [
  ((lon - lonMin) / (lonMax - lonMin)) * W,
  ((latMax - lat) / (latMax - latMin)) * H,
];

const inNear = (lon, lat) =>
  lon >= lonMin - 1 && lon <= lonMax + 1 && lat >= latMin - 1 && lat <= latMax + 1;

function ringToD(ring) {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const [x, y] = proj(lon, lat);
    d += (i === 0 ? "M" : " L") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return d + " Z";
}

function geometryHasAnyPointNear(coords) {
  let keep = false;
  (function scan(c) {
    for (const p of c) {
      if (keep) return;
      if (Array.isArray(p[0])) scan(p);
      else if (inNear(p[0], p[1])) {
        keep = true;
        return;
      }
    }
  })(coords);
  return keep;
}

const countries = [];
for (const f of gj.features) {
  const g = f.geometry;
  if (!g) continue;
  if (!geometryHasAnyPointNear(g.coordinates)) continue;

  const name = (f.properties && (f.properties.NAME_EN || f.properties.NAME)) || "";
  const iso = (f.properties && (f.properties.ISO_A2 || f.properties.ISO_A3)) || "";

  const paths = [];
  const addPoly = (poly) => {
    for (const ring of poly) {
      let any = false;
      for (const [lon, lat] of ring) {
        if (inNear(lon, lat)) {
          any = true;
          break;
        }
      }
      if (!any) continue;
      paths.push(ringToD(ring));
    }
  };

  if (g.type === "Polygon") addPoly(g.coordinates);
  else if (g.type === "MultiPolygon") for (const poly of g.coordinates) addPoly(poly);

  if (paths.length) countries.push({ name, iso, d: paths.join(" ") });
}

countries.sort((a, b) => String(a.name).localeCompare(String(b.name)));

let out = "";
for (const c of countries) {
  const isoSafe = String(c.iso).replaceAll('"', "");
  out += `<path class="country" data-iso="${isoSafe}" d="${c.d}" />\n`;
}

fs.writeFileSync("tmp_country_paths.svgfrag", out, "utf8");
console.log(`wrote tmp_country_paths.svgfrag (${countries.length} countries)`);


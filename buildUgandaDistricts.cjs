const fs = require('fs');
const a4 = JSON.parse(fs.readFileSync('uga_admin4.geojson', 'utf8'));

// Group features by district name
const districtsMap = new Map();
a4.features.forEach(f => {
  const dName = f.properties.adm2_name;
  if (!districtsMap.has(dName)) {
    districtsMap.set(dName, []);
  }
  districtsMap.get(dName).push(f);
});

function getDistrictBounds(features) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  function scan(coords) {
    if (typeof coords[0] === 'number') {
      const lon = coords[0], lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      coords.forEach(scan);
    }
  }
  features.forEach(f => scan(f.geometry.coordinates));
  return { minLon, maxLon, minLat, maxLat };
}

function perpendicularDistance(pt, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt[0] - lineStart[0], pt[1] - lineStart[1]);
  const u = ((pt[0] - lineStart[0]) * dx + (pt[1] - lineStart[1]) * dy) / (mag * mag);
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = lineStart[0] + clampedU * dx;
  const projY = lineStart[1] + clampedU * dy;
  return Math.hypot(pt[0] - projX, pt[1] - projY);
}

function rdp(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = rdp(points.slice(0, maxIndex + 1), tolerance);
    const right = rdp(points.slice(maxIndex), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

function simplifyRing(ring, projectFn, tolerance = 0.6) {
  const projected = ring.map(pt => projectFn(pt[0], pt[1]));
  const simplified = rdp(projected, tolerance);
  if (simplified.length < 3) return projected;
  return simplified;
}

function ringToPath(ring, projectFn) {
  const simplified = simplifyRing(ring, projectFn, 0.6);
  return simplified.map((pt, i) => (i === 0 ? 'M ' : 'L ') + pt[0] + ',' + pt[1]).join(' ') + ' Z';
}

function geometryToPath(geometry, projectFn) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(r => ringToPath(r, projectFn)).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => poly.map(r => ringToPath(r, projectFn)).join(' ')).join(' ');
  }
  return '';
}

function calcCentroid(geometry, projectFn, fallbackLat, fallbackLon) {
  let totalArea = 0, cx = 0, cy = 0, sumX = 0, sumY = 0, ptsCount = 0;
  function processRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = projectFn(ring[i][0], ring[i][1]);
      const [x1, y1] = projectFn(ring[i+1][0], ring[i+1][1]);
      const cross = (x0 * y1 - x1 * y0);
      totalArea += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
      sumX += x0;
      sumY += y0;
      ptsCount++;
    }
  }
  if (geometry.type === 'Polygon') {
    processRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    let maxPts = 0, mainPoly = geometry.coordinates[0];
    geometry.coordinates.forEach(poly => {
      if (poly[0].length > maxPts) {
        maxPts = poly[0].length;
        mainPoly = poly;
      }
    });
    processRing(mainPoly[0]);
  }
  if (Math.abs(totalArea) > 0.001) {
    const area = totalArea * 0.5;
    return { labelX: Number((cx / (6 * area)).toFixed(1)), labelY: Number((cy / (6 * area)).toFixed(1)) };
  }
  if (fallbackLat != null && fallbackLon != null) {
    const [fx, fy] = projectFn(fallbackLon, fallbackLat);
    return { labelX: fx, labelY: fy };
  }
  if (ptsCount > 0) {
    return { labelX: Number((sumX / ptsCount).toFixed(1)), labelY: Number((sumY / ptsCount).toFixed(1)) };
  }
  return { labelX: 300, labelY: 300 };
}

const allDistrictsResult = {};

for (const [districtName, features] of districtsMap.entries()) {
  const bounds = getDistrictBounds(features);
  const lonSpan = bounds.maxLon - bounds.minLon;
  const latSpan = bounds.maxLat - bounds.minLat;
  const svgWidth = 600, svgHeight = 600, padding = 30;
  const drawWidth = svgWidth - padding * 2;
  const drawHeight = svgHeight - padding * 2;
  const scale = Math.min(drawWidth / (lonSpan || 0.001), drawHeight / (latSpan || 0.001));
  const offsetX = padding + (drawWidth - lonSpan * scale) / 2;
  const offsetY = padding + (drawHeight - latSpan * scale) / 2;

  const viewMinLon = bounds.minLon - offsetX / scale;
  const viewMaxLon = bounds.minLon + (svgWidth - offsetX) / scale;
  const viewMaxLat = bounds.maxLat + offsetY / scale;
  const viewMinLat = bounds.maxLat - (svgHeight - offsetY) / scale;

  function project(lon, lat) {
    const x = offsetX + (lon - bounds.minLon) * scale;
    const y = offsetY + (bounds.maxLat - lat) * scale;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  }

  const p0 = features[0].properties;
  const subdivisions = features.map(f => {
    const props = f.properties;
    const d = geometryToPath(f.geometry, project);
    const centroid = calcCentroid(f.geometry, project, props.center_lat, props.center_lon);
    return {
      name: props.adm4_name,
      pcode: props.adm4_pcode,
      area_sqkm: Number((props.area_sqkm || 0).toFixed(2)),
      center_lat: props.center_lat,
      center_lon: props.center_lon,
      d,
      labelX: centroid.labelX,
      labelY: centroid.labelY
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  allDistrictsResult[districtName] = {
    districtName,
    districtPcode: p0.adm2_pcode,
    region: p0.adm1_name,
    subdivisionsCount: subdivisions.length,
    geoViewBox: viewMinLon.toFixed(6) + ' ' + viewMaxLat.toFixed(6) + ' ' + viewMaxLon.toFixed(6) + ' ' + viewMinLat.toFixed(6),
    width: svgWidth,
    height: svgHeight,
    subdivisions
  };
}

const fileContent = `export interface UgandaSubdivision {
  name: string;
  pcode: string;
  area_sqkm: number;
  center_lat: number;
  center_lon: number;
  d: string;
  labelX: number;
  labelY: number;
}

export interface UgandaDistrictMapData {
  districtName: string;
  districtPcode: string;
  region: string;
  subdivisionsCount: number;
  geoViewBox: string;
  width: number;
  height: number;
  subdivisions: UgandaSubdivision[];
}

export const UGANDA_DISTRICTS_DATA: Record<string, UgandaDistrictMapData> = ${JSON.stringify(allDistrictsResult, null, 2)};
`;

fs.writeFileSync('ugandaDistrictsData.ts', fileContent, 'utf8');
console.log('Done! Generated ugandaDistrictsData.ts for all', Object.keys(allDistrictsResult).length, 'districts!');
console.log('Optimized File size:', (fs.statSync('ugandaDistrictsData.ts').size / 1024).toFixed(1), 'KB');

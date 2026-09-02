const fs = require('fs');

const a2 = JSON.parse(fs.readFileSync('uga_admin2.geojson', 'utf8'));

// Uganda Bounds
const minLon = 29.572161692;
const maxLon = 35.001053628;
const minLat = -1.481474347;
const maxLat = 4.231367005;

const lonSpan = maxLon - minLon;
const latSpan = maxLat - minLat;

const svgWidth = 600;
const svgHeight = 630;
const padding = 20;

const drawWidth = svgWidth - padding * 2;
const drawHeight = svgHeight - padding * 2;

const scale = Math.min(drawWidth / lonSpan, drawHeight / latSpan);

const offsetX = padding + (drawWidth - lonSpan * scale) / 2;
const offsetY = padding + (drawHeight - latSpan * scale) / 2;

const viewMinLon = minLon - offsetX / scale;
const viewMaxLon = minLon + (svgWidth - offsetX) / scale;
const viewMaxLat = maxLat + offsetY / scale;
const viewMinLat = maxLat - (svgHeight - offsetY) / scale;

function project(lon, lat) {
  const x = offsetX + (lon - minLon) * scale;
  const y = offsetY + (maxLat - lat) * scale;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function simplifyPoints(pts, minSqDist = 0.25) {
  if (pts.length <= 4) return pts;
  const result = [pts[0]];
  let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const curr = pts[i];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    if (dx * dx + dy * dy >= minSqDist) {
      result.push(curr);
      prev = curr;
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

function ringToPath(ring) {
  const projected = ring.map(pt => project(pt[0], pt[1]));
  const simplified = simplifyPoints(projected, 0.25);
  return simplified.map((pt, i) => (i === 0 ? 'M ' : 'L ') + pt[0] + ',' + pt[1]).join(' ') + ' Z';
}

function geometryToPath(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToPath).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => poly.map(ringToPath).join(' ')).join(' ');
  }
  return '';
}

function calcCentroid(geometry, fallbackLat, fallbackLon) {
  let totalArea = 0;
  let cx = 0, cy = 0;
  let ptsCount = 0;
  let sumX = 0, sumY = 0;

  function processRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = project(ring[i][0], ring[i][1]);
      const [x1, y1] = project(ring[i+1][0], ring[i+1][1]);
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
    let maxPts = 0;
    let mainPoly = geometry.coordinates[0];
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
    cx = cx / (6 * area);
    cy = cy / (6 * area);
    return { labelX: Number(cx.toFixed(1)), labelY: Number(cy.toFixed(1)) };
  }

  if (fallbackLat != null && fallbackLon != null) {
    const [fx, fy] = project(fallbackLon, fallbackLat);
    return { labelX: fx, labelY: fy };
  }

  if (ptsCount > 0) {
    return { labelX: Number((sumX / ptsCount).toFixed(1)), labelY: Number((sumY / ptsCount).toFixed(1)) };
  }

  return { labelX: 0, labelY: 0 };
}

const districts = a2.features.map(f => {
  const name = f.properties.adm2_name;
  const d = geometryToPath(f.geometry);
  const centroid = calcCentroid(f.geometry, f.properties.center_lat, f.properties.center_lon);
  return {
    name,
    d,
    labelX: centroid.labelX,
    labelY: centroid.labelY
  };
});

districts.sort((a, b) => a.name.localeCompare(b.name));

const ugObject = {
  id: 'UG',
  paths: districts,
  geoViewBox: viewMinLon.toFixed(6) + ' ' + viewMaxLat.toFixed(6) + ' ' + viewMaxLon.toFixed(6) + ' ' + viewMinLat.toFixed(6),
  width: svgWidth,
  height: svgHeight
};

const oldContent = fs.readFileSync('countryPaths.ts', 'utf8');
const ugStart = oldContent.indexOf('  "UG": {');
const keStart = oldContent.indexOf('  "KE": {');

const ugFormatted = '  "UG": ' + JSON.stringify(ugObject, null, 2).replace(/\n/g, '\n  ') + ',\n';

const newContent = oldContent.substring(0, ugStart) + ugFormatted + oldContent.substring(keStart);

fs.writeFileSync('countryPaths.ts', newContent, 'utf8');
console.log('Successfully updated countryPaths.ts with calibrated Uganda map data!');

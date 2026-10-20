
const fs = require('fs');

const content = fs.readFileSync('src/data/maps/generated/africaPaths.ts', 'utf8');
const paths = [...content.matchAll(/"d":\s*"([^"]+)"/g)].map((match) => match[1]);
if (paths.length === 0) {
    console.error('Could not find map paths');
    process.exit(1);
}

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

paths.forEach(d => {
    const coords = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (coords) {
        for (let i = 0; i < coords.length; i += 2) {
            const x = parseFloat(coords[i]);
            const y = parseFloat(coords[i+1]);
            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
});

console.log(`Bounding Box: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
console.log(`Width: ${maxX - minX}, Height: ${maxY - minY}`);

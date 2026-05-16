/**
 * Generate placeholder PWA icons for development.
 * In production, replace these with proper designed icons.
 * 
 * Usage: node scripts/generate-icons.js
 * Requires: node (no external deps)
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate minimal SVG icons
function generateSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a237e"/>
      <stop offset="100%" style="stop-color:#283593"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#bg)"/>
  <text x="${size / 2}" y="${size * 0.62}" text-anchor="middle"
    fill="white" font-size="${size * 0.45}" font-weight="800"
    font-family="system-ui, sans-serif">B</text>
  <text x="${size / 2}" y="${size * 0.85}" text-anchor="middle"
    fill="rgba(255,255,255,0.6)" font-size="${size * 0.08}"
    font-family="system-ui, sans-serif">BRAINBYTES</text>
</svg>`;
}

// Ensure directory exists
fs.mkdirSync(ICONS_DIR, { recursive: true });

// Generate icons
for (const size of SIZES) {
  const svgContent = generateSvgIcon(size);
  const filePath = path.join(ICONS_DIR, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Generated: icon-${size}x${size}.svg`);
}

// Also generate as PNG placeholder note
console.log('\n📝 Note: SVG icons generated. For production, convert to PNG format.');
console.log('   You can use a tool like `npx sharp-cli` to convert SVGs to PNGs:');
console.log('   npx sharp-cli input.svg output.png');

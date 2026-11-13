/**
 * Rasterises the cricket-ball brand mark into the icon set and the social card.
 * Run with: node scripts/generate-icons.mjs
 * Outputs are committed; this script is the reproducible source for them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "src", "app");
const publicDir = path.join(root, "public");

/** The ball mark, centred in a 64×64 box. `bg` adds a full-bleed background. */
function ballSvg(size, { background = false, radius = 24 } = {}) {
  const bg = background
    ? `<rect width="64" height="64" rx="13" fill="#0a0f1a"/>`
    : `<circle cx="32" cy="32" r="30" fill="#0f172a"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  ${bg}
  <circle cx="32" cy="32" r="${radius}" fill="#dc2626"/>
  <circle cx="32" cy="32" r="${radius}" fill="none" stroke="#7f1d1d" stroke-width="1"/>
  <ellipse cx="32" cy="32" rx="${(radius * 0.36).toFixed(2)}" ry="${radius}" fill="none" stroke="#f8fafc" stroke-width="2" stroke-dasharray="3 3"/>
</svg>`;
}

async function png(svgString, size, file) {
  const buffer = await sharp(Buffer.from(svgString)).resize(size, size).png().toBuffer();
  await writeFile(file, buffer);
  console.log(`wrote ${path.relative(root, file)} (${size}×${size})`);
}

/** ICO container holding PNG-compressed entries (Vista+ format, widely supported). */
function ico(pngEntries) {
  const count = pngEntries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const directory = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  pngEntries.forEach(({ size, buffer }, index) => {
    const entry = directory.subarray(index * 16, index * 16 + 16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    bodies.push(buffer);
  });
  return Buffer.concat([header, directory, ...bodies]);
}

const SOCIAL_W = 1200;
const SOCIAL_H = 630;

function socialSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_W}" height="${SOCIAL_H}" viewBox="0 0 ${SOCIAL_W} ${SOCIAL_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0f1a"/>
      <stop offset="1" stop-color="#13203a"/>
    </linearGradient>
    <radialGradient id="orbIndigo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#6366f1" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbEmerald" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#10b981" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <rect width="${SOCIAL_W}" height="${SOCIAL_H}" fill="url(#bg)"/>
  <circle cx="180" cy="90" r="360" fill="url(#orbIndigo)"/>
  <circle cx="1080" cy="600" r="380" fill="url(#orbEmerald)"/>
  <g transform="translate(600 196)">
    <circle r="104" fill="#0f172a"/>
    <circle r="86" fill="#dc2626"/>
    <circle r="86" fill="none" stroke="#7f1d1d" stroke-width="3"/>
    <ellipse rx="31" ry="86" fill="none" stroke="#f8fafc" stroke-width="6" stroke-dasharray="10 10"/>
  </g>
  <text x="600" y="416" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="96" font-weight="800" letter-spacing="2" fill="url(#title)">PUNDIT ARENA</text>
  <text x="600" y="486" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="38" font-weight="600" fill="#cbd5e1">Retain. Build. Score. Smash.</text>
  <text x="600" y="556" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="#64748b">A fan-made cricket playground</text>
</svg>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  // Manifest / PWA icons (full-bleed dark background, maskable-friendly).
  await png(ballSvg(192, { background: true }), 192, path.join(publicDir, "icon-192.png"));
  await png(ballSvg(512, { background: true }), 512, path.join(publicDir, "icon-512.png"));

  // Apple touch icon: served at the literal /apple-touch-icon.png path iOS probes.
  await png(ballSvg(180, { background: true, radius: 25 }), 180, path.join(publicDir, "apple-touch-icon.png"));

  // Favicon: multi-size ICO with PNG entries (Next auto-detects src/app/favicon.ico).
  const sizes = [16, 32, 48];
  const entries = [];
  for (const size of sizes) {
    const buffer = await sharp(Buffer.from(ballSvg(size, { radius: 26 })))
      .resize(size, size)
      .png()
      .toBuffer();
    entries.push({ size, buffer });
  }
  await writeFile(path.join(appDir, "favicon.ico"), ico(entries));
  console.log(`wrote src/app/favicon.ico (${sizes.join("/")}px)`);

  // Social card (Next auto-detects opengraph-image.png / twitter-image.png).
  const social = await sharp(Buffer.from(socialSvg())).png().toBuffer();
  await writeFile(path.join(appDir, "opengraph-image.png"), social);
  await writeFile(path.join(appDir, "twitter-image.png"), social);
  console.log(`wrote src/app/opengraph-image.png + twitter-image.png (${SOCIAL_W}×${SOCIAL_H})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
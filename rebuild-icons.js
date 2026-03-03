/**
 * rebuild-icons.js
 * Trims transparent padding from ChroniNotes_big.png, resizes to all
 * required sizes, and packs a proper multi-resolution .ico file.
 *
 * Usage: node rebuild-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'src-tauri', 'icons');
const SOURCE    = path.join(ICONS_DIR, 'ChroniNotes_big.png');
const ICO_OUT   = path.join(ICONS_DIR, 'ChroniNotes.ico');

// Sizes to embed in the .ico  (Windows uses 16, 24, 32, 48, 64, 128, 256)
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// Extra PNGs that Tauri's bundle config references
const EXTRA_PNGS = [
  { file: '32x32.png',       size: 32  },
  { file: '128x128.png',     size: 128 },
  { file: '128x128@2x.png',  size: 256 },
  { file: 'ChroniNotes_big.png', size: 512 },  // keep original slot but rewrite trimmed
];

async function main() {
  console.log('Reading source:', SOURCE);

  // 1. Trim transparent padding — sharp's `trim()` auto-detects alpha edges
  const trimmed = await sharp(SOURCE)
    .trim({ threshold: 0 })   // threshold=0 → only fully transparent pixels
    .toBuffer({ resolveWithObject: true });

  console.log(`Trimmed canvas: ${trimmed.info.width}x${trimmed.info.height} (was 512x512)`);

  // 2. Rebuild extra PNGs used by the bundle
  for (const { file, size } of EXTRA_PNGS) {
    const outPath = path.join(ICONS_DIR, file);
    await sharp(trimmed.data)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`  wrote ${file} (${size}x${size})`);
  }

  // 3. Build each ICO frame as a raw PNG buffer
  const frames = [];
  for (const size of ICO_SIZES) {
    const buf = await sharp(trimmed.data)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    frames.push({ size, buf });
    console.log(`  prepared ico frame ${size}x${size} (${buf.length} bytes)`);
  }

  // 4. Pack the .ico binary manually
  //    ICO format:
  //      6-byte header  (reserved=0, type=1, count=N)
  //      N × 16-byte directory entries
  //      N × raw PNG blobs
  const count = frames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;
  const dataOffset = headerSize + dirSize;

  // Calculate offsets for each image blob
  let offset = dataOffset;
  const offsets = frames.map(f => {
    const o = offset;
    offset += f.buf.length;
    return o;
  });

  const totalSize = offset;
  const ico = Buffer.alloc(totalSize);

  // Header
  ico.writeUInt16LE(0, 0);      // reserved
  ico.writeUInt16LE(1, 2);      // type: 1 = ICO
  ico.writeUInt16LE(count, 4);  // image count

  // Directory entries
  frames.forEach(({ size, buf }, i) => {
    const base = headerSize + i * dirEntrySize;
    ico[base + 0] = size === 256 ? 0 : size;   // width  (0 = 256)
    ico[base + 1] = size === 256 ? 0 : size;   // height (0 = 256)
    ico[base + 2] = 0;                          // color count (0 = no palette)
    ico[base + 3] = 0;                          // reserved
    ico.writeUInt16LE(1,           base + 4);   // color planes
    ico.writeUInt16LE(32,          base + 6);   // bits per pixel
    ico.writeUInt32LE(buf.length,  base + 8);   // image data size
    ico.writeUInt32LE(offsets[i],  base + 12);  // image data offset
  });

  // Image data
  frames.forEach(({ buf }, i) => {
    buf.copy(ico, offsets[i]);
  });

  fs.writeFileSync(ICO_OUT, ico);
  console.log(`\n✅  Wrote ${ICO_OUT} (${(totalSize / 1024).toFixed(1)} KB, ${count} sizes)`);
}

main().catch(e => { console.error(e); process.exit(1); });

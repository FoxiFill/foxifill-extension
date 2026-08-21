import { access, readFile } from "node:fs/promises";

const sizes = [16, 32, 48, 128];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const size of sizes) {
  const pngPath = `public/icons/icon${size}.png`;
  const svgPath = `public/icons/icon${size}.svg`;
  await access(svgPath);

  const png = await readFile(pngPath);
  if (png.length < 24 || !png.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${pngPath} is not a valid PNG file`);
  }

  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
    throw new Error(`${pngPath} must be ${size}x${size}`);
  }
}

console.log(`Verified ${sizes.length} PNG and SVG extension icon sizes.`);

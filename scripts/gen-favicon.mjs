// Script to convert the generated PNG to favicon.ico
// Uses sharp (if available) or copies PNG as-is with correct naming

import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const srcPng = "/home/muzammil/.gemini/antigravity/brain/a9c849ca-7c98-4c7a-9d12-77767eaaaa68/cinetrack_favicon_1780481143563.png";
const destIco = join(__dirname, "../src/app/favicon.ico");
const destPng = join(__dirname, "../public/favicon.png");

// Copy PNG to public for use as apple-touch-icon etc
copyFileSync(srcPng, destPng);
console.log("✓ Copied PNG to public/favicon.png");

// Try to use sharp for ICO conversion
try {
  const sharp = (await import("sharp")).default;
  const pngBuffer = readFileSync(srcPng);
  // Resize to 32x32 for favicon
  const resized = await sharp(pngBuffer).resize(64, 64).png().toBuffer();
  writeFileSync(destIco, resized); // browsers accept PNG-encoded .ico
  console.log("✓ Wrote favicon.ico (64x64 PNG) to src/app/favicon.ico");
} catch {
  // sharp not available — just copy PNG as ICO (most browsers support this)
  copyFileSync(srcPng, destIco);
  console.log("✓ Copied PNG as favicon.ico to src/app/favicon.ico (sharp not available)");
}

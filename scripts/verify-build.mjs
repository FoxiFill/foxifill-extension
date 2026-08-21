import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "dist/manifest.json",
  "dist/content.js",
  "dist/background/sw.js",
  "dist/popup/popup.html",
  "dist/popup.js",
];

await Promise.all(requiredFiles.map((file) => access(file)));

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
if (manifest.manifest_version !== 3) {
  throw new Error("Expected a Manifest V3 build");
}

if (!manifest.version || !manifest.action?.default_popup) {
  throw new Error("Built manifest is missing version or popup metadata");
}

console.log(`Verified FoxiFill extension build ${manifest.version} with ${requiredFiles.length} required files.`);

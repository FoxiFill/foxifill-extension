import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const sourcePopupHtml = path.join(distDir, "src", "popup", "popup.html");
const targetPopupDir = path.join(distDir, "popup");
const targetPopupHtml = path.join(targetPopupDir, "popup.html");

await mkdir(targetPopupDir, { recursive: true });
await rename(sourcePopupHtml, targetPopupHtml);
await rm(path.join(distDir, "src"), { recursive: true, force: true });

const html = await readFile(targetPopupHtml, "utf8");
const rewrittenHtml = html.replaceAll('src="/', 'src="../').replaceAll('href="/', 'href="../');

await writeFile(targetPopupHtml, rewrittenHtml);

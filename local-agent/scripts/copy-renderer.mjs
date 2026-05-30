import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src", "renderer");
const dest = path.join(root, "dist", "renderer");
fs.mkdirSync(dest, { recursive: true });
for (const name of ["index.html", "publishTaskLogDisplay.js", "app.js", "style.css"]) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log("copied renderer assets -> dist/renderer");

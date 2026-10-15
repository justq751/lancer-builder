// Parses every *.json the site serves (data/, locales/) and lists the ones
// that are broken, with the parser's position. Runs first in `npm test` and
// in CI: a stray comma in a translation file fails here in a second, with
// the file name, instead of as a vague load error in the browser tests.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["data", "locales"];

function* jsonFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(path);
    else if (entry.name.endsWith(".json")) yield path;
  }
}

let count = 0;
const broken = [];
for (const dir of DIRS) {
  for (const file of jsonFiles(join(ROOT, dir))) {
    count++;
    try {
      JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      broken.push(`${relative(ROOT, file)}: ${err.message}`);
    }
  }
}

if (broken.length) {
  console.error(`Invalid JSON in ${broken.length} of ${count} file(s):\n` + broken.join("\n"));
  process.exit(1);
}
console.log(`JSON ok: ${count} files in ${DIRS.join(", ")}`);

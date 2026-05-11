import fs from "node:fs";

const msgFile = process.argv[2];
if (!msgFile) process.exit(0);

const line = "Co-authored-by: Cursor <cursoragent@cursor.com>";
let s = fs.readFileSync(msgFile, "utf8");
const next = s
  .split(/\r?\n/)
  .filter((l) => l.trim() !== line)
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\s*$/, "");

if (next !== s.trimEnd()) fs.writeFileSync(msgFile, `${next}\n`);

/* Roll the store back to a previous release in one command (1.17).
   Usage:  node scripts/rollback.mjs v1.16.0
   What it does: restores every tracked file to the state of that tag (history is kept — nothing is rewritten),
   commits, and tags a new patch release so the client stores pick it up through the normal release workflow.
   It never touches the database, orders or products. */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target || !/^v\d+\.\d+\.\d+$/.test(target)) {
  console.error("usage: node scripts/rollback.mjs vX.Y.Z   (a tag that exists, e.g. v1.16.0)");
  process.exit(1);
}
const sh = (cmd) =>
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();

const tags = sh("git tag --list").split(/\r?\n/).filter(Boolean);
if (!tags.includes(target)) {
  console.error(`tag ${target} not found. Known tags: ${tags.slice(-8).join(", ")}`);
  process.exit(1);
}
if (sh("git status --porcelain")) {
  console.error("working tree has uncommitted changes — commit or discard them first (git status).");
  process.exit(1);
}
const current = JSON.parse(readFileSync("package.json", "utf8")).version;
const [major, minor, patch] = current.split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;

console.log(`rolling back files to ${target} → publishing as v${next}`);
sh(`git checkout ${target} -- .`);
// keep the version moving forward so the client update workflow accepts it
for (const file of ["package.json", "package-lock.json"]) {
  const text = readFileSync(file, "utf8").replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${next}"`);
  execSync(`node -e "require('fs').writeFileSync('${file}', process.argv[1])" -- ${JSON.stringify(text)}`);
}
execSync(
  `node -e "const f='assets/js/version.js';const fs=require('fs');fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace(/TEMPLATE_VERSION = \\"[^\\"]+\\"/, 'TEMPLATE_VERSION = \\"${next}\\"'))"`
);
sh("git add -A");
sh(`git commit -m "rollback to ${target} (as ${next})"`);
sh(`git tag v${next}`);
console.log(`done. Now run:  git push && git push --tags`);

/**
 * esbuild로 번들 후 pkg로 Windows exe 생성.
 * 사용: npm run build:exe
 */
import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const entry = path.join(root, "dist", "schedule.js");
const outfile = path.join(root, "dist", "schedule.bundle.cjs");

if (!fs.existsSync(entry)) {
  console.error("먼저 npm run build 로 dist/schedule.js 를 만드세요.");
  process.exit(1);
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile,
  format: "cjs",
  logLevel: "info",
  legalComments: "none",
});

const releaseDir = path.join(root, "release");
if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
const outExe = path.join(releaseDir, "coupang-wp-publisher.exe");

const r = spawnSync(
  "npx",
  ["pkg", outfile, "-t", "node18-win-x64", "-o", outExe],
  { stdio: "inherit", cwd: root, shell: true },
);
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
console.log(`\n생성됨: ${outExe}`);
console.log("exe와 같은 폴더에 .env, data/keywords.json 을 두고 실행하세요.");

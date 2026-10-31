import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
await cp(path.join(root, "web"), dist, { recursive: true });
await mkdir(path.join(dist, "engine"), { recursive: true });
execFileSync(
  "go",
  [
    "build",
    "-trimpath",
    "-ldflags=-s -w",
    "-o",
    path.join(dist, "engine/chords.wasm"),
    "./cmd/wasm",
  ],
  {
    cwd: root,
    env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
    stdio: "inherit",
  },
);
const goRoot = execFileSync("go", ["env", "GOROOT"], {
  encoding: "utf8",
}).trim();
await cp(
  path.join(goRoot, "lib/wasm/wasm_exec.js"),
  path.join(dist, "engine/wasm_exec.js"),
);
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("Built dist/ — static files ready for GitHub Pages.");

import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
// Keep the worker, Go runtime and WASM together across cached deployments.
const engineFiles = ["worker.js", "wasm_exec.js", "chords.wasm"];
const hash = createHash("sha256");
for (const file of engineFiles)
  hash.update(await readFile(path.join(dist, "engine", file)));
const version = hash.digest("hex").slice(0, 16);
const versioned = (file) => file.replace(/(\.[^.]+)$/, `.${version}$1`);
for (const file of engineFiles)
  await rename(path.join(dist, "engine", file), path.join(dist, "engine", versioned(file)));
for (const file of ["voicings.js", `engine/${versioned("worker.js")}`]) {
  const target = path.join(dist, file);
  let source = await readFile(target, "utf8");
  for (const asset of engineFiles) source = source.replace(asset, versioned(asset));
  await writeFile(target, source);
}
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("Built dist/ — static files ready for GitHub Pages.");

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const build = path.join(root, "plugin/build");
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: "inherit" });
run(process.execPath, ["scripts/build.mjs"]);
run("python3", ["plugin/scripts/package_web.py", "dist", "plugin/build/web.zip"]);
const args = ["-S", "plugin", "-B", build, "-DCMAKE_BUILD_TYPE=Release"];
if (process.platform === "darwin") args.push("-DCMAKE_OSX_ARCHITECTURES=arm64;x86_64", "-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0");
if (process.env.CREST_JUCE_SOURCE) args.push(`-DCREST_JUCE_SOURCE=${process.env.CREST_JUCE_SOURCE}`);
run("cmake", args);
run("cmake", ["--build", build, "--parallel", process.env.CREST_BUILD_JOBS || "4"]);
const bundle = path.join(build, "CrestChordReference_artefacts/Release/VST3/Crest Chord Reference.vst3");
if (process.platform === "darwin" && existsSync(bundle)) {
  const licenses = path.join(bundle, "Contents/Resources/Licenses");
  mkdirSync(licenses, { recursive: true });
  cpSync(path.join(build, "licenses"), licenses, { recursive: true });
  run("codesign", ["--force", "--deep", "--sign", "-", bundle]);
}
console.log(`Built: ${bundle}`);

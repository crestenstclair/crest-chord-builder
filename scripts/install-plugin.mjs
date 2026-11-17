import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("This installer currently targets macOS.");
const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "plugin/build/CrestChordReference_artefacts/Release/VST3/Crest Chord Reference.vst3");
const directory = path.join(os.homedir(), "Library/Audio/Plug-Ins/VST3");
const destination = path.join(directory, path.basename(source));
if (!existsSync(source)) throw new Error("Build the plug-in first with npm run build:plugin.");
mkdirSync(directory, { recursive: true });
if (existsSync(destination)) {
  const backup = path.join(root, "output/plugin-backups", `${Date.now()}-Crest Chord Reference.vst3`);
  mkdirSync(path.dirname(backup), { recursive: true });
  execFileSync("ditto", [destination, backup], { stdio: "inherit" });
  console.log(`Previous installation backed up: ${backup}`);
}
execFileSync("ditto", [source, destination], { stdio: "inherit" });
execFileSync("codesign", ["--verify", "--deep", "--strict", destination], { stdio: "inherit" });
console.log(`Installed: ${destination}\nIn Ableton: Settings → Plug-ins → Rescan, then add Crest Chord Reference to an audio track.`);

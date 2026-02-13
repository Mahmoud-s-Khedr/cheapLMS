import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const targetMap = {
  "linux:x64": "x86_64-unknown-linux-gnu",
  "linux:arm64": "aarch64-unknown-linux-gnu",
  "win32:x64": "x86_64-pc-windows-msvc",
  "win32:arm64": "aarch64-pc-windows-msvc",
};

function main() {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error("ffmpeg-static binary not found. Reinstall dependencies with npm install.");
  }

  const key = `${process.platform}:${process.arch}`;
  const targetTriple = targetMap[key];

  if (!targetTriple) {
    throw new Error(`Unsupported platform/arch for sidecar prep: ${key}`);
  }

  const binariesDir = path.join(projectRoot, "src-tauri", "binaries");
  mkdirSync(binariesDir, { recursive: true });

  const extension = process.platform === "win32" ? ".exe" : "";
  const destinationName = `ffmpeg-${targetTriple}${extension}`;
  const destinationPath = path.join(binariesDir, destinationName);

  copyFileSync(ffmpegPath, destinationPath);

  if (process.platform !== "win32") {
    chmodSync(destinationPath, 0o755);
  }

  console.log(`Prepared FFmpeg sidecar: ${destinationName}`);
}

try {
  main();
} catch (error) {
  console.error("Failed to prepare FFmpeg sidecar:", error.message);
  process.exit(1);
}

// Idempotent yt-dlp restore: pnpm/npm prune the untracked
// node_modules/youtube-dl-exec/bin/yt-dlp.exe binary on install, so the
// root postinstall re-fetches it — but only when actually missing (the
// download hits the GitHub releases API, which is rate-limited).
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import youtubedl from "youtube-dl-exec";

const YOUTUBE_DL_PATH = youtubedl.constants.YOUTUBE_DL_PATH;

if (existsSync(YOUTUBE_DL_PATH)) {
  console.log(`[postinstall] yt-dlp binary present at ${YOUTUBE_DL_PATH}`);
} else {
  console.log("[postinstall] yt-dlp binary missing — downloading…");
  execFileSync(process.execPath, ["node_modules/youtube-dl-exec/scripts/postinstall.js"], {
    stdio: "inherit",
  });
}

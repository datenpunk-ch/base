import { spawnSync } from "node:child_process";

// Minimal, dependency-free spellcheck hook.
// It runs cspell via npx if available. (CI workflow uses npm ci.)

const res = spawnSync("npx", ["--yes", "cspell", "--no-progress", "--config", "cspell.json", "content/en.json"], {
  stdio: "inherit",
  shell: true
});

process.exit(res.status ?? 1);


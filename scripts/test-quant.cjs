const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const output = path.join(process.cwd(), ".test-build");
fs.rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [
  require.resolve("typescript/bin/tsc"), "--target", "ES2020", "--module", "commonjs",
  "--strict", "--skipLibCheck", "--outDir", output,
  "lib/quant/engine.ts", "lib/data/quality.ts",
], { stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/quant.test.cjs", "tests/quality.test.cjs"], { stdio: "inherit" });
fs.rmSync(output, { recursive: true, force: true });

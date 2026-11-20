const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const output = path.join(process.cwd(), ".test-build");
fs.rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [
  require.resolve("typescript/bin/tsc"), "--target", "ES2020", "--module", "commonjs",
  "--strict", "--skipLibCheck", "--outDir", output,
  "lib/quant/engine.ts", "lib/quant/features.ts", "lib/quant/signals.ts",
  "lib/quant/supabase-pipeline.ts", "lib/data/quality.ts",
  "lib/ingestion/fred-adapter.ts", "lib/ingestion/supabase-rest.ts",
], { stdio: "inherit" });
execFileSync(process.execPath, ["--test",
  "tests/quant.test.cjs", "tests/quality.test.cjs",
  "tests/fred-adapter.test.cjs", "tests/supabase-rest.test.cjs",
  "tests/features.test.cjs",
], { stdio: "inherit" });
fs.rmSync(output, { recursive: true, force: true });

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const output = path.join(process.cwd(), ".test-build");
fs.rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [
  require.resolve("typescript/bin/tsc"), "--target", "ES2020", "--module", "commonjs",
  "--strict", "--skipLibCheck", "--outDir", output,
  "lib/research/backtest.ts", "lib/research/walk-forward.ts", "lib/research/futures-execution.ts", "lib/quant/engine.ts", "lib/quant/calibration.ts", "lib/quant/features.ts", "lib/quant/signals.ts",
  "lib/quant/supabase-pipeline.ts", "lib/data/market-overview.ts", "lib/data/quality.ts",
  "lib/ingestion/fred-adapter.ts", "lib/ingestion/cftc-adapter.ts", "lib/ingestion/cme-inventory-csv.ts", "lib/ingestion/licensed-price-csv.ts",
  "lib/ingestion/supabase-rest.ts",
], { stdio: "inherit" });
execFileSync(process.execPath, ["--test",
  "tests/backtest.test.cjs", "tests/walk-forward.test.cjs", "tests/futures-execution.test.cjs", "tests/quant.test.cjs", "tests/quality.test.cjs",
  "tests/fred-adapter.test.cjs", "tests/cftc-adapter.test.cjs", "tests/cme-inventory-csv.test.cjs", "tests/licensed-price-csv.test.cjs",
  "tests/supabase-rest.test.cjs", "tests/features.test.cjs", "tests/quant-pipeline.test.cjs", "tests/market-overview.test.cjs", "tests/calibration.test.cjs",
], { stdio: "inherit" });
fs.rmSync(output, { recursive: true, force: true });

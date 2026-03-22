export {};

const [summaryPath = "coverage/summary.txt", lineThresholdArg = "75", functionThresholdArg = "70"] =
  process.argv.slice(2);

const lineThreshold = Number(lineThresholdArg);
const functionThreshold = Number(functionThresholdArg);

if (!Number.isFinite(lineThreshold) || !Number.isFinite(functionThreshold)) {
  console.error(
    `Invalid coverage thresholds: lines=${lineThresholdArg}, functions=${functionThresholdArg}`
  );
  process.exit(1);
}

const summary = await Bun.file(summaryPath).text();
const match = summary.match(/^All files\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|/m);

if (!match) {
  console.error(`Could not find the coverage summary row in ${summaryPath}`);
  process.exit(1);
}

const [, functionsRaw, linesRaw] = match;
const functions = Number(functionsRaw);
const lines = Number(linesRaw);

if (Number.isNaN(functions) || Number.isNaN(lines)) {
  console.error(`Failed to parse coverage values from ${summaryPath}`);
  process.exit(1);
}

const errors: string[] = [];
if (lines < lineThreshold) {
  errors.push(`lines ${lines.toFixed(2)}% < ${lineThreshold.toFixed(2)}%`);
}
if (functions < functionThreshold) {
  errors.push(`functions ${functions.toFixed(2)}% < ${functionThreshold.toFixed(2)}%`);
}

if (errors.length > 0) {
  console.error(`Coverage check failed: ${errors.join(", ")}`);
  process.exit(1);
}

console.log(
  `Coverage check passed: lines ${lines.toFixed(2)}% / functions ${functions.toFixed(2)}%`
);

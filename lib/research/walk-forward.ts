export interface DatedObservation { timestamp: string; }
export interface WalkForwardOptions {
  minimumTrainSize: number;
  testSize: number;
  stepSize?: number;
  embargoSize?: number;
  window?: "expanding" | "rolling";
}
export interface WalkForwardFold<T> {
  index: number;
  train: T[];
  test: T[];
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
}

export function createWalkForwardFolds<T extends DatedObservation>(
  observations: T[],
  options: WalkForwardOptions,
): WalkForwardFold<T>[] {
  const { minimumTrainSize, testSize } = options;
  const stepSize = options.stepSize ?? testSize;
  const embargoSize = options.embargoSize ?? 0;
  const window = options.window ?? "expanding";
  for (const [name, value] of Object.entries({ minimumTrainSize, testSize, stepSize, embargoSize })) {
    if (!Number.isInteger(value) || value < (name === "embargoSize" ? 0 : 1)) {
      throw new Error(`${name} must be a valid integer.`);
    }
  }
  for (let i = 0; i < observations.length; i++) {
    const time = Date.parse(observations[i].timestamp);
    if (!Number.isFinite(time)) throw new Error("All observations must have valid timestamps.");
    if (i > 0 && time <= Date.parse(observations[i - 1].timestamp)) {
      throw new Error("Observations must be strictly chronological and unique.");
    }
  }
  const folds: WalkForwardFold<T>[] = [];
  let index = 0;
  for (let testStartIndex = minimumTrainSize + embargoSize;
    testStartIndex + testSize <= observations.length;
    testStartIndex += stepSize) {
    const trainEndIndex = testStartIndex - embargoSize;
    const trainStartIndex = window === "rolling" ? Math.max(0, trainEndIndex - minimumTrainSize) : 0;
    const train = observations.slice(trainStartIndex, trainEndIndex);
    const test = observations.slice(testStartIndex, testStartIndex + testSize);
    if (!train.length || !test.length) continue;
    folds.push({
      index: index++, train, test,
      trainStart: train[0].timestamp, trainEnd: train[train.length - 1].timestamp,
      testStart: test[0].timestamp, testEnd: test[test.length - 1].timestamp,
    });
  }
  return folds;
}

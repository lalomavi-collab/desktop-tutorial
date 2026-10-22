// Checks the pure geometry of the market style charts. Run: npm run market-chart-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  const dir = mkdtempSync(join(tmpdir(), "market-chart-"));
  const file = join(dir, "m.mjs");
  writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  return import(pathToFileURL(file).href);
};
const { monotonePath, areaPath, movingAverage, niceTicks, nearestIndex, shortNumber, mean, linearTrend } = await load("../src/lib/cockpit/marketChart.ts");

// The curve stays inside the band of its data: sample every cubic and check the y never leaves [min, max] of the two end points.
const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
function checkBand(vals) {
  const pts = vals.map((v, i) => [i * 50, 100 - v]);
  const d = monotonePath(pts);
  const segs = d.split("C").slice(1).map((s) => nums(s));
  segs.forEach((c, i) => {
    const y0 = pts[i][1], y3 = pts[i + 1][1], lo = Math.min(y0, y3) - 0.02, hi = Math.max(y0, y3) + 0.02;
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t, y = u ** 3 * y0 + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t ** 3 * y3;
      assert.ok(y >= lo && y <= hi, `overshoot in ${vals} segment ${i} at t=${t}: ${y} not in [${lo}, ${hi}]`);
    }
  });
}
// At a local extremum or a flat run the tangent must be level, or the curve dips past the point it should peak on.
function checkLevelAtExtrema(vals) {
  const pts = vals.map((v, i) => [i * 50, 100 - v]);
  const segs = monotonePath(pts).split("C").slice(1).map((s) => nums(s));
  for (let i = 1; i < vals.length - 1; i++) {
    if ((vals[i] - vals[i - 1]) * (vals[i + 1] - vals[i]) > 0) continue;
    assert.ok(Math.abs(segs[i - 1][3] - pts[i][1]) < 0.02, `${vals}: tangent into point ${i} is not level`);
    assert.ok(Math.abs(segs[i][1] - pts[i][1]) < 0.02, `${vals}: tangent out of point ${i} is not level`);
  }
}
for (const v of [[0, 0, 1, 0, 2, 0, 0], [10, 2, 9, 1, 8], [7, 0, 0, 0, 7], [0, 5, 5, 20, 20, 21]]) checkLevelAtExtrema(v);
for (const v of [[0, 0, 1, 0, 2, 0, 0], [3, 3, 3, 3], [0, 5, 5, 20, 20, 21], [10, 2, 9, 1, 8], [0, 1, 2, 3, 4, 5], [7, 0, 0, 0, 7]]) checkBand(v);
assert.equal(monotonePath([]), "");
assert.match(monotonePath([[1, 2]]), /^M1 2$/);
assert.equal(monotonePath([[0, 0], [10, 10]]).startsWith("M0 0 C"), true);
assert.ok(areaPath("M0 0 C1 1 2 2 3 3", [[0, 0], [3, 3]], 50).endsWith("Z"));
assert.equal(areaPath("M0 0", [[0, 0]], 50), "");

assert.deepEqual(movingAverage([2, 4, 6, 8], 2), [2, 3, 5, 7]);
assert.deepEqual(movingAverage([5], 4), [5]);
assert.equal(movingAverage([1, 2, 3, 4, 5], 3).length, 5);

assert.deepEqual(niceTicks(0, 100, 4), [0, 25, 50, 75, 100]);
assert.deepEqual(niceTicks(0, 7, 4), [0, 2, 4, 6]);
assert.deepEqual(niceTicks(3, 3), [3]);
assert.ok(niceTicks(0, 76620, 4).every((t) => Number.isFinite(t)));

assert.equal(nearestIndex(0, 0, 50, 5), 0);
assert.equal(nearestIndex(-30, 0, 50, 5), 0);
assert.equal(nearestIndex(120, 0, 50, 5), 2);
assert.equal(nearestIndex(9999, 0, 50, 5), 4);
assert.equal(nearestIndex(10, 0, 50, 1), 0);

assert.equal(shortNumber(76620), "76.6K");
assert.equal(shortNumber(1250000), "1.25M");
assert.equal(shortNumber(0), "0");
assert.equal(shortNumber(-4200), "-4.2K");
assert.equal(shortNumber(999), "999");

// runningTotal: items older than the window are counted in from the start, each step equals what the bucket added, the end is the total.
const { runningTotal } = await load("../src/lib/cockpit/marketChart.ts");
{
  const added = [0, 2, 0, 1, 0, 4], older = 5;
  const run = runningTotal(added, older);
  assert.deepEqual(run, [5, 7, 7, 8, 8, 12]);
  assert.equal(run[run.length - 1], older + added.reduce((a, v) => a + v, 0));
  assert.deepEqual(runningTotal([], 3), []);
}
assert.equal(mean([2, 4, 6]), 4);
assert.equal(mean([]), 0);
{
  const t1 = linearTrend([1, 3, 5, 7]);
  assert.ok(Math.abs(t1.slope - 2) < 1e-9 && Math.abs(t1.intercept - 1) < 1e-9, "exact line is recovered");
  const flat = linearTrend([4, 4, 4]);
  assert.ok(flat.slope === 0 && flat.intercept === 4);
  assert.deepEqual(linearTrend([9]), { slope: 0, intercept: 9 });
  assert.deepEqual(linearTrend([]), { slope: 0, intercept: 0 });
  const noisy = linearTrend([0, 2, 1, 4, 3, 6]);
  assert.ok(noisy.slope > 0.8 && noisy.slope < 1.2, `slope of a rising noisy series: ${noisy.slope}`);
}
console.log("market-chart-check: ok");

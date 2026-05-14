import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const reportsPath = path.join(repoRoot, 'data/web/reports/table.json');
const pricesRoot = path.join(repoRoot, 'data/web/prices');
const outputPath = path.join(repoRoot, 'data/web/report-statistics-lab.json');

const THRESHOLDS = [0.6, 0.8, 1.0];
const HORIZONS = [30, 60, 120, 250];
const DELAYS = [0, 1, 3, 5, 10, 20];
const TRIGGERS = [0.03, 0.05, 0.1];
const TRIGGER_WINDOW = 20;
const POST_TARGET_DAYS = [5, 20, 60, 120];
const TARGET_MULTIPLES = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2];

const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
const outcomes = [];
const simulations = [];
const exclusions = { missing_price: 0, non_upside_target: 0, missing_entry_or_target: 0, short_history: 0 };

for (const report of reports) {
  const targetDirection = report.target_direction ?? report.targetDirection;
  const entry = finite(report.entry_price_native ?? report.entry_price ?? report.publication_price_native);
  const target = finite(report.target_price_native ?? report.target_price);
  if (targetDirection !== 'upside' || !entry || !target || target <= entry) {
    exclusions.non_upside_target += 1;
    continue;
  }
  const prices = readPrices(report.symbol, report.date ?? report.publication_date);
  if (!prices.length) {
    exclusions.missing_price += 1;
    continue;
  }
  if (prices.length < 20) {
    exclusions.short_history += 1;
    continue;
  }
  const pathStats = pathStatsFromPrices(prices, entry);
  const thresholdHits = Object.fromEntries(
    THRESHOLDS.map((threshold) => [
      String(threshold),
      firstThresholdHit(prices, thresholdPrice(entry, target, threshold)),
    ]),
  );
  outcomes.push({
    reportId: report.report_id,
    symbol: report.symbol,
    company: report.company,
    publicationDate: report.date ?? report.publication_date,
    entryPrice: round(entry),
    targetPrice: round(target),
    targetReturn: round(target / entry - 1, 6),
    currentReturn: finite(report.current_return),
    maxFavorableExcursion: pathStats.mfe,
    maxAdverseExcursion: pathStats.mae,
    upsideCaptureRatio: round(pathStats.mfe / Math.max(0.000001, target / entry - 1), 6),
    hit: Object.fromEntries(
      THRESHOLDS.map((threshold) => [
        String(threshold),
        {
          hit: thresholdHits[String(threshold)] !== null,
          days: thresholdHits[String(threshold)],
          within: Object.fromEntries(
            HORIZONS.map((horizon) => [
              String(horizon),
              thresholdHits[String(threshold)] !== null && thresholdHits[String(threshold)] <= horizon,
            ]),
          ),
        },
      ]),
    ),
  });

  for (const horizon of HORIZONS) {
    for (const delay of DELAYS) {
      simulations.push(delaySimulation(report, prices, entry, target, delay, horizon));
    }
    for (const triggerPct of TRIGGERS) {
      simulations.push(triggerSimulation(report, prices, entry, target, 'dip', triggerPct, horizon));
      simulations.push(triggerSimulation(report, prices, entry, target, 'rally', triggerPct, horizon));
    }
    for (const targetMultiple of TARGET_MULTIPLES) {
      simulations.push(targetMultipleSimulation(report, prices, entry, target, targetMultiple, horizon));
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  sample: {
    reportCount: reports.length,
    eligibleReportCount: outcomes.length,
    tickerCount: new Set(outcomes.map((row) => row.symbol)).size,
    startDate: min(outcomes.map((row) => row.publicationDate)),
    endDate: max(outcomes.map((row) => row.publicationDate)),
    exclusions,
  },
  fractionalHitRates: buildFractionalHitRates(outcomes),
  delayedEntry: buildDelayedEntry(simulations),
  entryTriggers: buildEntryTriggers(simulations),
  postTargetDrift: buildPostTargetDrift(outcomes),
  optimalTargetMultiples: buildOptimalTargetMultiples(simulations),
  riskScatter: outcomes.map((row) => ({
    reportId: row.reportId,
    symbol: row.symbol,
    company: row.company,
    publicationDate: row.publicationDate,
    maxFavorableExcursion: row.maxFavorableExcursion,
    maxAdverseExcursion: row.maxAdverseExcursion,
    upsideCaptureRatio: row.upsideCaptureRatio,
    targetReturn: row.targetReturn,
    currentReturn: row.currentReturn,
    hit06: row.hit['0.6'].hit,
    hit08: row.hit['0.8'].hit,
    hit10: row.hit['1'].hit,
  })),
  topExamples: {
    upsideCapture: [...outcomes].sort((a, b) => b.upsideCaptureRatio - a.upsideCaptureRatio).slice(0, 8),
    fast08: [...outcomes]
      .filter((row) => row.hit['0.8'].days !== null)
      .sort((a, b) => a.hit['0.8'].days - b.hit['0.8'].days)
      .slice(0, 8),
    painfulWinners: [...outcomes]
      .filter((row) => row.hit['0.8'].hit)
      .sort((a, b) => a.maxAdverseExcursion - b.maxAdverseExcursion)
      .slice(0, 8),
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify({ summary }, null, 2)}\n`);
console.log(
  `[report-statistics-lab] wrote ${path.relative(repoRoot, outputPath)} outcomes=${outcomes.length} simulations=${simulations.length}`,
);

function readPrices(symbol, startDate) {
  const file = path.join(pricesRoot, `${symbol}.json`);
  if (!fs.existsSync(file)) return [];
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (artifact.prices ?? [])
    .filter((point) => String(point.date) >= String(startDate))
    .map((point) => ({
      date: String(point.date),
      close: finite(point.close) ?? finite(point.close_krw),
      high: finite(point.high) ?? finite(point.close) ?? finite(point.close_krw),
      low: finite(point.low) ?? finite(point.close) ?? finite(point.close_krw),
    }))
    .filter((point) => point.close && point.high && point.low && point.close > 0 && point.high > 0 && point.low > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function pathStatsFromPrices(prices, entry) {
  const maxHigh = Math.max(...prices.map((point) => point.high));
  const minLow = Math.min(...prices.map((point) => point.low));
  return { mfe: round(maxHigh / entry - 1, 6), mae: round(minLow / entry - 1, 6) };
}

function thresholdPrice(entry, target, fraction) {
  return entry + (target - entry) * fraction;
}

function firstThresholdHit(prices, price) {
  const index = prices.findIndex((point) => point.high >= price);
  return index >= 0 ? index : null;
}

function delaySimulation(report, prices, originalEntry, target, delay, horizon) {
  const entryIndex = Math.min(delay, prices.length - 1);
  const entryPoint = prices[entryIndex];
  const window = prices.slice(entryIndex, Math.min(prices.length, entryIndex + horizon + 1));
  const exitPoint = window.at(-1);
  const target08 = thresholdPrice(entryPoint.close, target, 0.8);
  const hit08Index = window.findIndex((point) => point.high >= target08);
  return {
    reportId: report.report_id,
    symbol: report.symbol,
    strategy: 'delay',
    delayDays: delay,
    horizonDays: horizon,
    entered: true,
    entryDate: entryPoint.date,
    daysToEntry: delay,
    realizedReturn: round(exitPoint.close / entryPoint.close - 1, 6),
    maxDrawdownAfterEntry: round(Math.min(...window.map((point) => point.low)) / entryPoint.close - 1, 6),
    maxUpsideAfterEntry: round(Math.max(...window.map((point) => point.high)) / entryPoint.close - 1, 6),
    hit08: hit08Index >= 0,
    daysToHit08: hit08Index >= 0 ? hit08Index : null,
    targetReturnAtEntry: round(target / entryPoint.close - 1, 6),
    originalTargetReturn: round(target / originalEntry - 1, 6),
  };
}

function triggerSimulation(report, prices, entry, target, type, triggerPct, horizon) {
  const triggerPrice = type === 'dip' ? entry * (1 - triggerPct) : entry * (1 + triggerPct);
  const triggerIndex = prices
    .slice(0, TRIGGER_WINDOW + 1)
    .findIndex((point) => (type === 'dip' ? point.low <= triggerPrice : point.high >= triggerPrice));
  const base = {
    reportId: report.report_id,
    symbol: report.symbol,
    strategy: type === 'dip' ? 'dip_entry' : 'rally_entry',
    triggerPct,
    horizonDays: horizon,
    entered: triggerIndex >= 0,
  };
  const hit08BeforeTrigger = firstThresholdHit(prices.slice(0, TRIGGER_WINDOW + 1), thresholdPrice(entry, target, 0.8));
  if (triggerIndex < 0) {
    return {
      ...base,
      missedOpportunity: hit08BeforeTrigger !== null,
      realizedReturn: null,
      maxDrawdownAfterEntry: null,
      hit08: null,
    };
  }
  const entryPoint = prices[triggerIndex];
  const window = prices.slice(triggerIndex, Math.min(prices.length, triggerIndex + horizon + 1));
  const exitPoint = window.at(-1);
  const target08 = thresholdPrice(entryPoint.close, target, 0.8);
  const hit08Index = window.findIndex((point) => point.high >= target08);
  const drawdown = Math.min(...window.map((point) => point.low)) / entryPoint.close - 1;
  return {
    ...base,
    entryDate: entryPoint.date,
    daysToEntry: triggerIndex,
    realizedReturn: round(exitPoint.close / entryPoint.close - 1, 6),
    maxDrawdownAfterEntry: round(drawdown, 6),
    maxUpsideAfterEntry: round(Math.max(...window.map((point) => point.high)) / entryPoint.close - 1, 6),
    hit08: hit08Index >= 0,
    daysToHit08: hit08Index >= 0 ? hit08Index : null,
    missedOpportunity: false,
    falseBreakout: type === 'rally' && drawdown <= -0.1 && hit08Index < 0,
  };
}

function targetMultipleSimulation(report, prices, entry, target, targetMultiple, horizon) {
  const targetPriceForMultiple = thresholdPrice(entry, target, targetMultiple);
  const window = prices.slice(0, Math.min(prices.length, horizon + 1));
  const hitIndex = window.findIndex((point) => point.high >= targetPriceForMultiple);
  const exitPrice = hitIndex >= 0 ? targetPriceForMultiple : window.at(-1).close;
  const returns = window.map((point) => point.low / entry - 1);
  return {
    reportId: report.report_id,
    symbol: report.symbol,
    strategy: 'take_profit_multiple',
    targetMultiple,
    horizonDays: horizon,
    entered: true,
    hit: hitIndex >= 0,
    exitReason: hitIndex >= 0 ? 'target_fraction_hit' : 'horizon',
    daysToExit: hitIndex >= 0 ? hitIndex : window.length - 1,
    realizedReturn: round(exitPrice / entry - 1, 6),
    maxDrawdownAfterEntry: round(Math.min(...returns), 6),
  };
}

function buildFractionalHitRates(rows) {
  return THRESHOLDS.flatMap((threshold) =>
    HORIZONS.map((horizon) => {
      const hits = rows.filter((row) => row.hit[String(threshold)].within[String(horizon)]).length;
      const days = rows
        .map((row) => row.hit[String(threshold)].days)
        .filter((value) => Number.isFinite(value) && value <= horizon);
      return {
        threshold,
        horizonDays: horizon,
        hitRate: ratio(hits, rows.length),
        sampleSize: rows.length,
        hitCount: hits,
        medianDaysToHit: median(days),
        ci95: wilson(hits, rows.length),
      };
    }),
  );
}

function buildDelayedEntry(rows) {
  return DELAYS.flatMap((delay) =>
    HORIZONS.map((horizon) =>
      summarizeSimulations(
        rows.filter((row) => row.strategy === 'delay' && row.delayDays === delay && row.horizonDays === horizon),
        { delayDays: delay, horizonDays: horizon },
      ),
    ),
  );
}

function buildEntryTriggers(rows) {
  return ['dip_entry', 'rally_entry'].flatMap((strategy) =>
    TRIGGERS.flatMap((triggerPct) =>
      HORIZONS.map((horizon) => {
        const subset = rows.filter(
          (row) => row.strategy === strategy && row.triggerPct === triggerPct && row.horizonDays === horizon,
        );
        const entered = subset.filter((row) => row.entered);
        const returns = entered.map((row) => row.realizedReturn).filter(Number.isFinite);
        return {
          type: strategy === 'dip_entry' ? 'dip' : 'rally',
          triggerPct,
          horizonDays: horizon,
          entryRate: ratio(entered.length, subset.length),
          sampleSize: subset.length,
          enteredCount: entered.length,
          medianReturn: median(returns),
          meanReturn: mean(returns),
          hitRate08: ratio(entered.filter((row) => row.hit08).length, entered.length),
          medianDrawdown: median(entered.map((row) => row.maxDrawdownAfterEntry).filter(Number.isFinite)),
          missedOpportunityRate:
            strategy === 'dip_entry'
              ? ratio(subset.filter((row) => row.missedOpportunity).length, subset.length)
              : null,
          falseBreakoutRate:
            strategy === 'rally_entry'
              ? ratio(entered.filter((row) => row.falseBreakout).length, entered.length)
              : null,
        };
      }),
    ),
  );
}

function buildPostTargetDrift(rows) {
  return POST_TARGET_DAYS.map((daysAfterTarget) => {
    const returns = [];
    for (const row of rows) {
      const hitDay = row.hit['1'].days;
      if (!Number.isFinite(hitDay)) continue;
      const prices = readPrices(row.symbol, row.publicationDate);
      const hitPoint = prices[hitDay];
      const future = prices[hitDay + daysAfterTarget];
      if (!hitPoint || !future) continue;
      returns.push(future.close / hitPoint.close - 1);
    }
    return {
      daysAfterTarget,
      sampleSize: returns.length,
      medianReturn: median(returns),
      meanReturn: mean(returns),
      p25Return: quantile(returns, 0.25),
      p75Return: quantile(returns, 0.75),
      p10Return: quantile(returns, 0.1),
      p90Return: quantile(returns, 0.9),
      sharePositive: ratio(returns.filter((value) => value > 0).length, returns.length),
    };
  });
}

function buildOptimalTargetMultiples(rows) {
  return TARGET_MULTIPLES.flatMap((targetMultiple) =>
    HORIZONS.map((horizon) => {
      const subset = rows.filter(
        (row) =>
          row.strategy === 'take_profit_multiple' &&
          row.targetMultiple === targetMultiple &&
          row.horizonDays === horizon,
      );
      const returns = subset.map((row) => row.realizedReturn).filter(Number.isFinite);
      const p25 = quantile(returns, 0.25);
      const downsideRisk = Math.abs(Math.min(0, p25 ?? 0));
      const hitRate = ratio(subset.filter((row) => row.hit).length, subset.length);
      const medianReturn = median(returns);
      return {
        targetMultiple,
        horizonDays: horizon,
        hitRate,
        sampleSize: subset.length,
        medianReturn,
        meanReturn: mean(returns),
        p25Return: p25,
        downsideRisk,
        rewardReliabilityScore: round(((medianReturn ?? 0) * hitRate) / (downsideRisk + 0.05), 6),
      };
    }),
  );
}

function summarizeSimulations(rows, extra) {
  const returns = rows.map((row) => row.realizedReturn).filter(Number.isFinite);
  return {
    ...extra,
    sampleSize: rows.length,
    medianReturn: median(returns),
    meanReturn: mean(returns),
    p25Return: quantile(returns, 0.25),
    p75Return: quantile(returns, 0.75),
    winRate: ratio(returns.filter((value) => value > 0).length, returns.length),
    hitRate08: ratio(rows.filter((row) => row.hit08).length, rows.length),
    medianDrawdown: median(rows.map((row) => row.maxDrawdownAfterEntry).filter(Number.isFinite)),
  };
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function ratio(num, den) {
  return den > 0 ? round(num / den, 6) : null;
}

function mean(values) {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return null;
  return round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length, 6);
}

function median(values) {
  return quantile(values, 0.5);
}

function quantile(values, q) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) return null;
  const pos = (finiteValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = finiteValues[base + 1];
  const value = next === undefined ? finiteValues[base] : finiteValues[base] + rest * (next - finiteValues[base]);
  return round(value, 6);
}

function wilson(successes, total) {
  if (!total) return [null, null];
  const z = 1.96;
  const phat = successes / total;
  const denom = 1 + (z * z) / total;
  const center = (phat + (z * z) / (2 * total)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) / denom;
  return [round(Math.max(0, center - margin), 6), round(Math.min(1, center + margin), 6)];
}

function min(values) {
  return values.length ? values.reduce((a, b) => (a < b ? a : b)) : null;
}

function max(values) {
  return values.length ? values.reduce((a, b) => (a > b ? a : b)) : null;
}

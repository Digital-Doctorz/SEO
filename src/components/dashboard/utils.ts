export function formatNum(num: number | null | undefined): string {
  const n = Number(num);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export function getComparePercent(val1: number, val2: number): number {
  const total = val1 + val2;
  if (total === 0) return 50;
  return Math.round((val1 / total) * 100);
}

export function buildTrendData(
  targetTraffic: number,
  competitorTraffic?: number | null
): Array<Record<string, string | number>> {
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const targetFactors = [0.82, 0.85, 0.89, 0.92, 0.96, 1.0];
  const competitorFactors = [1.05, 1.03, 0.98, 1.01, 0.99, 1.0];
  return months.map((month, idx) => {
    const dataPoint: Record<string, string | number> = {
      name: month,
      targetValue: Math.round(targetTraffic * targetFactors[idx]),
    };
    if (competitorTraffic != null) {
      dataPoint.competitorValue = Math.round(competitorTraffic * competitorFactors[idx]);
    }
    return dataPoint;
  });
}
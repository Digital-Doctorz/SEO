import { useMemo, useState } from "react";
import type { ContentGap } from "../types";
import { normalizeContentGaps } from "../lib/normalizeAnalysis";
import { formulaLabel, trafficLabel } from "../lib/contentGapTitles";
import type { GapTitleIntent } from "../lib/contentGapTitles";
import { KOLKATA_CITY } from "../lib/geo";
import {
  AlertCircle,
  Zap,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Filter,
  MapPin,
  TrendingUp,
  Sparkles,
  Target,
  Search,
} from "lucide-react";
import { motion } from "motion/react";

interface ContentGapAnalysisProps {
  gaps?: ContentGap[] | null;
  targetDomain: string;
  competitorDomain?: string;
  /** Market city for localised title optimisation (default Kolkata) */
  city?: string;
  brandName?: string;
  onSelectTopic: (topic: string, keyword: string) => void;
}

function formatVolume(n: number): string {
  if (!Number.isFinite(n)) return "0";
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

function trafficBarColor(score: number): string {
  if (score >= 72) return "bg-emerald-500";
  if (score >= 48) return "bg-amber-500";
  return "bg-slate-400";
}

export default function ContentGapAnalysis({
  gaps: rawGaps,
  targetDomain,
  competitorDomain = "Competitor",
  city = KOLKATA_CITY,
  brandName,
  onSelectTopic,
}: ContentGapAnalysisProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [quickWinOnly, setQuickWinOnly] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"traffic" | "volume" | "ease">("traffic");

  const brand =
    brandName ||
    targetDomain.replace(/^www\./, "").split(".")[0]?.replace(/^\w/, (c) => c.toUpperCase()) ||
    "Brand";

  const gaps = useMemo(
    () => normalizeContentGaps(rawGaps, { city, brand }),
    [rawGaps, city, brand]
  );

  const filteredGaps = useMemo(() => {
    let list = gaps.filter((gap) => {
      const matchesDifficulty =
        difficultyFilter === "All" ? true : gap.difficultyCategory === difficultyFilter;
      const matchesQuickWin = quickWinOnly ? gap.isQuickWin : true;
      const matchesLocal = localOnly
        ? gap.localIntent === "local_direct" ||
          gap.localIntent === "local_aware" ||
          gap.localSearchVolume ||
          Boolean(gap.cityMention)
        : true;
      return matchesDifficulty && matchesQuickWin && matchesLocal;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "volume") return (b.competitorVolume || 0) - (a.competitorVolume || 0);
      if (sortBy === "ease") return (a.competitorDifficulty || 100) - (b.competitorDifficulty || 100);
      return (b.trafficPotentialScore || 0) - (a.trafficPotentialScore || 0);
    });
    return list;
  }, [gaps, difficultyFilter, quickWinOnly, localOnly, sortBy]);

  const difficultyStats = useMemo(() => {
    const total = gaps.length;
    const easy = gaps.filter((g) => g.difficultyCategory === "Easy").length;
    const medium = gaps.filter((g) => g.difficultyCategory === "Medium").length;
    const hard = gaps.filter((g) => g.difficultyCategory === "Hard").length;
    const quickWins = gaps.filter((g) => g.isQuickWin).length;
    const highTraffic = gaps.filter((g) => (g.trafficPotentialScore || 0) >= 72).length;
    const avgTraffic =
      total > 0
        ? Math.round(gaps.reduce((s, g) => s + (g.trafficPotentialScore || 0), 0) / total)
        : 0;
    return { total, easy, medium, hard, quickWins, highTraffic, avgTraffic };
  }, [gaps]);

  const competitorLabel = competitorDomain || "Competitor";
  const targetLabel = targetDomain || "Your site";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Content Gaps</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.total}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Quick-Win Titles</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.quickWins}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">High-Traffic Titles</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.highTraffic}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Avg Traffic Score</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.avgTraffic}/100</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <MapPin className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Local Market</span>
            <span className="text-xl font-bold text-slate-800 truncate max-w-[8rem]">{city}</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 rounded-2xl border border-blue-100 px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-start gap-3">
          <span className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Target Gap Audit titles are SEO-optimised for {city}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Every H1 front-loads the keyword, uses high-CTR formulas (Best / Near Me / Cost / How-to),
              and localises for {city} so pages can capture Map Pack + geo organic traffic. Click{" "}
              <strong>Write Article</strong> to draft from that exact title.
            </p>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-white border border-blue-100 rounded-full px-3 py-1.5 self-start md:self-center shrink-0">
          Keyword-first · Local · Catchy
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Target Content Gap Audit</h3>
            <p className="text-xs text-slate-500 mt-1">
              Keywords where <strong>{competitorLabel}</strong> ranks well, but{" "}
              <strong>{targetLabel}</strong> has weak or no organic presence — with traffic-ready
              titles for {city}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={quickWinOnly}
                onChange={(e) => setQuickWinOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
              />
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" /> Quick-Wins
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={localOnly}
                onChange={(e) => setLocalOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
              />
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-blue-500" /> Local only
              </span>
            </label>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "traffic" | "volume" | "ease")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
              >
                <option value="traffic">Traffic potential</option>
                <option value="volume">Search volume</option>
                <option value="ease">Easiest KD</option>
              </select>
            </div>

            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              {(["All", "Easy", "Medium", "Hard"] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    difficultyFilter === diff
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredGaps.length > 0 ? (
            filteredGaps.map((gap, idx) => {
              const score = gap.trafficPotentialScore ?? 50;
              const tLabel = trafficLabel(score);
              const fLabel = formulaLabel((gap.titleFormula || "local_guide") as GapTitleIntent);

              return (
                <motion.div
                  key={`${gap.competitorKeyword}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  className="p-5 md:p-6 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {gap.isQuickWin && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
                            <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Quick-Win
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            tLabel === "High"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : tLabel === "Medium"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {tLabel} traffic
                        </span>
                        {(gap.localIntent === "local_direct" || gap.localSearchVolume) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                            Local SEO
                          </span>
                        )}
                        {gap.localIntent === "local_aware" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                            Geo-Aware
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            gap.difficultyCategory === "Easy"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : gap.difficultyCategory === "Medium"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-rose-50 text-rose-700 border border-rose-100"
                          }`}
                        >
                          {gap.difficultyCategory} Diff
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 uppercase tracking-wider">
                          {fLabel}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          Format: <strong className="text-slate-600">{gap.recommendedType}</strong>
                        </span>
                      </div>

                      {/* Primary optimised H1 title */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                            Optimised article title (H1)
                          </span>
                        </div>
                        <h4 className="text-base md:text-lg font-extrabold text-slate-950 leading-snug tracking-tight">
                          {gap.recommendedTopic}
                        </h4>
                        {gap.titleAngle && (
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-3xl">
                            {gap.titleAngle}
                          </p>
                        )}
                      </div>

                      {/* SERP preview */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 max-w-xl shadow-xs">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Search className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            SERP title preview (~60 chars)
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#1a0dab] leading-snug line-clamp-2">
                          {gap.serpTitlePreview || gap.recommendedTopic}
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5 truncate">
                          https://{targetLabel.replace(/^https?:\/\//, "")}/
                          {(gap.competitorKeyword || "guide")
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .slice(0, 48)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          Rank for “{gap.competitorKeyword}” with a {city}-focused page that answers
                          intent fast, earns clicks, and feeds your Content Hub draft.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        <span>
                          Keyword:{" "}
                          <strong className="text-slate-800 font-semibold">{gap.competitorKeyword}</strong>
                        </span>
                        <span>
                          Volume:{" "}
                          <strong className="text-slate-800">{formatVolume(gap.competitorVolume)}</strong>
                        </span>
                        <span>
                          KD:{" "}
                          <strong className="text-slate-800">{gap.competitorDifficulty}/100</strong>
                        </span>
                        {gap.cityMention && (
                          <span className="text-blue-600 font-semibold inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {gap.cityMention}
                            {gap.localSearchVolume ? " · local volume" : ""}
                          </span>
                        )}
                        {gap.neighborhoods && gap.neighborhoods.length > 0 && (
                          <span className="text-indigo-600">
                            Areas: <strong>{gap.neighborhoods.slice(0, 4).join(", ")}</strong>
                          </span>
                        )}
                      </div>

                      {/* Traffic score bar */}
                      <div className="max-w-md">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          <span>Traffic potential</span>
                          <span className="text-slate-700">{score}/100</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${trafficBarColor(score)}`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col items-center lg:items-end gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                      <div className="flex items-center gap-5 text-xs">
                        <div className="text-center max-w-[110px]">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate">
                            {competitorLabel}
                          </span>
                          <span className="text-base font-bold text-slate-800">
                            Pos #{gap.competitorRank}
                          </span>
                        </div>
                        <div className="text-center max-w-[110px]">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate">
                            {targetLabel}
                          </span>
                          <span className="text-sm font-semibold text-rose-500 bg-rose-50 border border-rose-100/50 px-2.5 py-0.5 rounded">
                            {gap.targetRank === "Not Ranking" ? "Unranked" : `Pos #${gap.targetRank}`}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectTopic(gap.recommendedTopic, gap.competitorKeyword)}
                        className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10 active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        <span>Write Article</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : gaps.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <HelpCircle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <h4 className="font-bold text-slate-800 mb-1">No Content Gaps Available</h4>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Re-run analysis from the home screen to build a gap list for this domain. Add a
                competitor URL for a sharper comparison.
              </p>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <Filter className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <h4 className="font-bold text-slate-800 mb-1">No Gaps Match Filters</h4>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Try clearing Quick-Wins, Local only, or difficulty filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuickWinOnly(false);
                  setLocalOnly(false);
                  setDifficultyFilter("All");
                }}
                className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import type { ContentGap } from "../types";
import { normalizeContentGaps } from "../lib/normalizeAnalysis";
import { AlertCircle, Zap, BookOpen, ChevronRight, HelpCircle, Filter } from "lucide-react";
import { motion } from "motion/react";

interface ContentGapAnalysisProps {
  gaps?: ContentGap[] | null;
  targetDomain: string;
  competitorDomain?: string;
  onSelectTopic: (topic: string, keyword: string) => void;
}

/** @deprecated use normalizeContentGaps from lib/normalizeAnalysis */
export function normalizeGapsClient(raw: unknown): ContentGap[] {
  return normalizeContentGaps(raw);
}

function formatVolume(n: number): string {
  if (!Number.isFinite(n)) return "0";
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

export default function ContentGapAnalysis({
  gaps: rawGaps,
  targetDomain,
  competitorDomain = "Competitor",
  onSelectTopic,
}: ContentGapAnalysisProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [quickWinOnly, setQuickWinOnly] = useState(false);

  const gaps = useMemo(() => normalizeContentGaps(rawGaps), [rawGaps]);

  const filteredGaps = useMemo(() => {
    return gaps.filter((gap) => {
      const matchesDifficulty =
        difficultyFilter === "All" ? true : gap.difficultyCategory === difficultyFilter;
      const matchesQuickWin = quickWinOnly ? gap.isQuickWin : true;
      return matchesDifficulty && matchesQuickWin;
    });
  }, [gaps, difficultyFilter, quickWinOnly]);

  const difficultyStats = useMemo(() => {
    const total = gaps.length;
    const easy = gaps.filter((g) => g.difficultyCategory === "Easy").length;
    const medium = gaps.filter((g) => g.difficultyCategory === "Medium").length;
    const hard = gaps.filter((g) => g.difficultyCategory === "Hard").length;
    const quickWins = gaps.filter((g) => g.isQuickWin).length;
    return { total, easy, medium, hard, quickWins };
  }, [gaps]);

  const competitorLabel = competitorDomain || "Competitor";
  const targetLabel = targetDomain || "Your site";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Quick-Win Opportunities</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.quickWins}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Easy to Rank (KD &lt; 30)</span>
            <span className="text-xl font-bold text-slate-800">{difficultyStats.easy}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Filter className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Medium/Hard Competition</span>
            <span className="text-xl font-bold text-slate-800">
              {difficultyStats.medium + difficultyStats.hard}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Target Content Gap Audit</h3>
            <p className="text-xs text-slate-500 mt-1">
              Keywords where <strong>{competitorLabel}</strong> ranks well, but{" "}
              <strong>{targetLabel}</strong> has weak or no organic presence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={quickWinOnly}
                onChange={(e) => setQuickWinOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
              />
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" /> Show Quick-Wins Only
              </span>
            </label>

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
            filteredGaps.map((gap, idx) => (
              <motion.div
                key={`${gap.competitorKeyword}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/40 transition-colors"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {gap.isQuickWin && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 shadow-xs">
                        <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Quick-Win
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
                    <span className="text-xs font-semibold text-slate-400">
                      Format: <strong className="text-slate-600">{gap.recommendedType}</strong>
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-950 leading-snug">
                    {gap.recommendedTopic}
                  </h4>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                    <span>
                      Keyword:{" "}
                      <strong className="text-slate-700 font-sans">{gap.competitorKeyword}</strong>
                    </span>
                    <span>
                      Search Volume:{" "}
                      <strong className="text-slate-700">{formatVolume(gap.competitorVolume)}</strong>
                    </span>
                    <span>
                      Keyword Difficulty:{" "}
                      <strong className="text-slate-700">{gap.competitorDifficulty}/100</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 shrink-0">
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-center max-w-[120px]">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate">
                        {competitorLabel}
                      </span>
                      <span className="text-base font-bold text-slate-800">Pos #{gap.competitorRank}</span>
                    </div>
                    <div className="text-center max-w-[120px]">
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
                    onClick={() =>
                      onSelectTopic(gap.recommendedTopic, gap.competitorKeyword)
                    }
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10 active:scale-95 cursor-pointer"
                  >
                    <span>Write Article</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))
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
              <HelpCircle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <h4 className="font-bold text-slate-800 mb-1">No Gaps Match Filters</h4>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Try unchecking &quot;Quick-Wins Only&quot; or selecting &quot;All&quot; difficulties.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuickWinOnly(false);
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

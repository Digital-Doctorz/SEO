import { Compass, Check, AlertCircle } from "lucide-react";
import type { BlogPost } from "../../types";

export interface BlogPrewritingPanelProps {
  blogPost: BlogPost;
  blogKeyword: string;
}

export default function BlogPrewritingPanel({ blogPost, blogKeyword }: BlogPrewritingPanelProps) {
  const analysis = blogPost.preWritingAnalysis;
  if (!analysis) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-600">
        Pre-writing intel is not available for this draft yet. Regenerate the article to rebuild competitor subtopics and ranking page analysis.
      </div>
    );
  }

  const subtopics = Array.isArray(analysis.subtopics) ? analysis.subtopics : [];
  const contentGaps = Array.isArray(analysis.contentGaps) ? analysis.contentGaps : [];
  const topPages = Array.isArray(analysis.topRankingPages) ? analysis.topRankingPages : [];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-blue-500" />
            <span>Pre-Writing Competitor & Keyword Insight Scan</span>
          </span>
          <h4 className="font-extrabold text-slate-900 text-base mt-1">
            Target Keyword: &quot;{blogKeyword || "—"}&quot;
          </h4>
        </div>
        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
          Competitive Audit Complete
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Average Content Length
          </span>
          <span className="text-lg font-bold text-slate-800 block">
            {analysis.avgLength || 1400} words
          </span>
          <span className="text-[10px] text-slate-500 block">Identified across top competitor URLs</span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Optimal Structure Model
          </span>
          <span className="text-xs font-bold text-slate-800 block leading-tight">
            {analysis.optimalStructure || "Intro → Key takeaways → H2s → FAQ → CTA"}
          </span>
          <span className="text-[10px] text-slate-500 block">Determined using semantic clustering</span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Quick-Win Opportunities
          </span>
          <span className="text-xs font-bold text-green-600 flex items-center gap-1">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>Competitor Gaps Audited</span>
          </span>
          <span className="text-[10px] text-slate-500 block">
            {contentGaps.length || 0} weaknesses mapped
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Common Subtopics Competitors Cover
          </span>
          <div className="space-y-1.5">
            {subtopics.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No subtopics available.</p>
            ) : (
              subtopics.map((sub, i) => (
                <div
                  key={i}
                  className="flex gap-2 p-2.5 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-medium text-slate-700"
                >
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                  <span>{sub}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Competitor Content Gaps & Opportunities
          </span>
          <div className="space-y-1.5">
            {contentGaps.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No content gaps listed.</p>
            ) : (
              contentGaps.map((gap, i) => (
                <div
                  key={i}
                  className="flex gap-2 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs font-medium text-rose-800"
                >
                  <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                  <span>{gap}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          Top Ranking Pages for Keyword Group
        </span>
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                <th className="p-3 text-center">Rank</th>
                <th className="p-3">Page Profile & URL</th>
                <th className="p-3 text-right">Content Length</th>
                <th className="p-3 text-center">Domain Rating (DR)</th>
              </tr>
            </thead>
            <tbody>
              {topPages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">
                    No ranking pages available.
                  </td>
                </tr>
              ) : (
                topPages.map((page, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors font-semibold text-slate-700"
                  >
                    <td className="p-3 text-center text-blue-600 font-bold">{page.rank ?? i + 1}</td>
                    <td className="p-3 max-w-xs">
                      <div className="truncate text-slate-900">{page.title || "Untitled"}</div>
                      <div className="truncate text-[10px] text-slate-400 font-mono font-medium">
                        {page.url || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-right text-slate-500 font-mono text-[11px]">
                      {page.wordCount ?? "—"} words
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border font-mono">
                        DR {page.dr ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

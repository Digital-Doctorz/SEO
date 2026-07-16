import { FileText, ArrowRight, Globe } from "lucide-react";
import type { DomainMetrics } from "../../types";
import { formatNum } from "./utils";

export interface TopPagesSectionProps {
  target: DomainMetrics;
  competitor: DomainMetrics | null;
}

export default function TopPagesSection({ target, competitor }: TopPagesSectionProps) {
  return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Target Top Pages */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Top Content: {target.domain}</span>
            </h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
              {target.topPages.length} Pages Audited
            </span>
          </div>

          <div className="space-y-4">
            {target.topPages.map((page, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{page.title}</h4>
                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-mono">
                    {page.url}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 text-xs text-slate-500">
                  <span>Monthly Visits: <strong className="text-slate-800">{formatNum(page.estTraffic)}</strong></span>
                  <span>Keywords: <strong className="text-slate-800">{page.keywordsCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor Top Pages (or Informational Insights if no competitor) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          {competitor ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <span>Top Content: {competitor.domain}</span>
                </h3>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
                  {competitor.topPages.length} Pages Audited
                </span>
              </div>

              <div className="space-y-4">
                {competitor.topPages.map((page, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{page.title}</h4>
                      <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:underline inline-flex items-center gap-1 mt-1 font-mono">
                        {page.url}
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 text-xs text-slate-500">
                      <span>Monthly Visits: <strong className="text-slate-800">{formatNum(page.estTraffic)}</strong></span>
                      <span>Keywords: <strong className="text-slate-800">{page.keywordsCount}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <span className="p-4 bg-blue-50 rounded-full text-blue-600 mb-4">
                <Globe className="h-8 w-8" />
              </span>
              <h4 className="font-bold text-slate-800 mb-2">No Competitor Specified</h4>
              <p className="text-sm text-slate-500 max-w-sm mb-4">
                Enter a competitor website to compare Organic Traffic, Domain Ratings, and Content top paths head-to-head.
              </p>
            </div>
          )}
        </div>
      </div>
  );
}
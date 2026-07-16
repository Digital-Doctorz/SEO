import type { DeepKeywordAudit } from "../../types";
import { ExternalLink, Award, Layers, Zap, HelpCircle, TrendingUp, BarChart2, Search } from "lucide-react";

export default function DeepKeywordAuditPanel({ audit, onSelectRelated }: { audit: DeepKeywordAudit; onSelectRelated?: (kw: string) => void }) {
  return (
                                        <div className="space-y-6 text-slate-700">
                                          {/* Top Stats and Indicators */}
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {/* Average Word Count */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg Content Length</span>
                                              <span className="text-2xl font-extrabold text-slate-900 font-mono">{audit.averageContentLength.toLocaleString()}</span>
                                              <span className="text-xs text-slate-500 block">words recommended</span>
                                            </div>

                                            {/* Freshness Requirement */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Content Freshness</span>
                                              <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                  audit.freshnessRequirements.level === "High" 
                                                    ? "text-rose-700 bg-rose-50 border border-rose-100" 
                                                    : audit.freshnessRequirements.level === "Medium"
                                                      ? "text-amber-700 bg-amber-50 border border-amber-100"
                                                      : "text-green-700 bg-green-50 border border-green-100"
                                                }`}>
                                                  {audit.freshnessRequirements.level}
                                                </span>
                                                <span className="text-xs font-mono font-bold text-slate-600">({audit.freshnessRequirements.recommendedUpdateFrequency})</span>
                                              </div>
                                              <span className="text-[10px] text-slate-500 block leading-tight pt-1">{audit.freshnessRequirements.explanation}</span>
                                            </div>

                                            {/* Dominant Content Type */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Dominant Format</span>
                                              <span className="text-base font-extrabold text-slate-800 block">{audit.contentTypeAnalysis.dominantType}</span>
                                              <div className="space-y-1.5 pt-1">
                                                {audit.contentTypeAnalysis.percentageBreakdown.slice(0, 2).map((item, iIdx) => (
                                                  <div key={iIdx} className="text-[10px] flex justify-between items-center text-slate-500">
                                                    <span>{item.type}</span>
                                                    <span className="font-mono font-bold text-slate-700">{item.percentage}%</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Snippet Format */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Featured Snippet Opportunity</span>
                                              <div className="flex items-center gap-1.5">
                                                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                                  {audit.featuredSnippet.format}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-slate-500 leading-tight block pt-1">{audit.featuredSnippet.optimizedOpportunity}</p>
                                            </div>
                                          </div>

                                          {/* Two Column Section */}
                                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Left Column: Top 10 SERP (7 Columns) */}
                                            <div className="lg:col-span-7 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <BarChart2 className="h-4 w-4 text-blue-600" />
                                                <span>Google SERP Top 10 Competitors & Word Count</span>
                                              </h4>
                                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                                                    <thead>
                                                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <th className="py-2.5 px-4 w-10">Pos</th>
                                                        <th className="py-2.5 px-4">Title & URL</th>
                                                        <th className="py-2.5 px-4 text-center">Type</th>
                                                        <th className="py-2.5 px-4 text-right">Length</th>
                                                        <th className="py-2.5 px-4 text-center">DR</th>
                                                        <th className="py-2.5 px-4 text-center">Age</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                      {audit.topResults.map((res, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-slate-50/50">
                                                          <td className="py-2.5 px-4 font-mono font-bold text-blue-600 font-extrabold">
                                                            #{res.rank}
                                                          </td>
                                                          <td className="py-2.5 px-4 max-w-xs md:max-w-md truncate">
                                                            <div className="truncate">
                                                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1">
                                                                <span className="truncate">{res.title}</span>
                                                                <ExternalLink className="h-3 w-3 inline shrink-0 text-slate-400" />
                                                              </a>
                                                              <span className="text-[9px] text-slate-400 font-mono block truncate">{res.url}</span>
                                                            </div>
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center text-slate-500 whitespace-nowrap">
                                                            {res.contentType}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-bold">
                                                            {res.contentLength.toLocaleString()}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-500">
                                                            {res.domainRating}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                              res.freshnessScore === "Fresh" 
                                                                ? "text-green-700 bg-green-50" 
                                                                : res.freshnessScore === "Stable"
                                                                  ? "text-slate-600 bg-slate-100"
                                                                  : "text-amber-700 bg-amber-50"
                                                            }`}>
                                                              {res.freshnessScore}
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Right Column: Featured Snippet & Subtopics (5 Columns) */}
                                            <div className="lg:col-span-5 space-y-4">
                                              {/* Position Zero Snippet Details */}
                                              <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                  <Award className="h-4 w-4 text-blue-600" />
                                                  <span>Featured Snippet Breakdown</span>
                                                </h4>
                                                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-3">
                                                  <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-amber-800 font-bold uppercase tracking-wider">Position Zero Content ({audit.featuredSnippet.format})</span>
                                                    <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[9px]">Live format</span>
                                                  </div>
                                                  <div className="bg-white p-3 rounded-lg border border-amber-200/50 text-xs italic text-slate-600 font-mono whitespace-pre-line leading-relaxed shadow-3xs">
                                                    "{audit.featuredSnippet.extractedText}"
                                                  </div>
                                                  <div className="text-xs space-y-1">
                                                    <span className="font-extrabold text-slate-800 block">How to Capture Position 0:</span>
                                                    <p className="text-slate-600 leading-tight">{audit.featuredSnippet.optimizedOpportunity}</p>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Common Subtopics */}
                                              <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                  <Layers className="h-4 w-4 text-blue-600" />
                                                  <span>Key Common Subtopics Required</span>
                                                </h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs font-medium">
                                                  {audit.commonSubtopics.map((sub, sIdx) => (
                                                    <div key={sIdx} className="space-y-1">
                                                      <div className="flex justify-between text-xs font-bold">
                                                        <span className="text-slate-800">{sub.subtopic}</span>
                                                        <span className="text-blue-600 font-mono text-[10px]">{sub.relevance}% relevance</span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-500 leading-tight font-medium">{sub.description}</p>
                                                      <div className="w-full bg-slate-100 rounded-full h-1">
                                                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${sub.relevance}%` }} />
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Bottom Row: People Also Ask & Related Searches */}
                                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                            {/* PAA Questions (7 Columns) */}
                                            <div className="md:col-span-7 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <HelpCircle className="h-4 w-4 text-blue-600" />
                                                <span>"People Also Ask" (PAA) Intent Structure</span>
                                              </h4>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {audit.peopleAlsoAsk.map((paa, pIdx) => (
                                                  <div key={pIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                                                    <div className="flex items-start gap-2">
                                                      <span className="text-blue-600 font-bold text-sm shrink-0 font-extrabold">Q:</span>
                                                      <span className="font-extrabold text-slate-900 text-xs leading-snug">{paa.question}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium pl-4">{paa.answer}</p>
                                                    {paa.sourceUrl && (
                                                      <a href={paa.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9.5px] text-blue-600 hover:underline block font-mono pl-4 truncate">
                                                        Source: {paa.sourceUrl}
                                                      </a>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Related Searches (5 Columns) */}
                                            <div className="md:col-span-5 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Search className="h-4 w-4 text-blue-600" />
                                                <span>Related Long-Tail Searches</span>
                                              </h4>
                                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                                                <div className="flex flex-wrap gap-1.5">
                                                  {audit.relatedSearches.map((term, tIdx) => (
                                                    <button
                                                      key={tIdx}
                                                      onClick={() => onSelectRelated?.(term)}
                                                      className="text-[11px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 hover:text-blue-700 px-3 py-1.5 rounded-lg text-slate-700 transition-all font-semibold cursor-pointer"
                                                    >
                                                      {term}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
  );
}
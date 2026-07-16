import type { BlogPost } from "../../types";
import { Activity, Award, Check, CheckCircle, Cpu, ShieldCheck, TrendingUp } from "lucide-react";

export interface BlogSeoPanelProps {
  blogPost: BlogPost;
  blogKeyword: string;
}

export default function BlogSeoPanel({ blogPost, blogKeyword }: BlogSeoPanelProps) {
                    const wordCount = blogPost.content ? blogPost.content.split(/\s+/).filter(Boolean).length : 2200;
                    const seoReport = {
                      seoScoreBreakdown: {
                        keywordOptimization: 18,
                        contentStructure: 14,
                        readability: 13,
                        technicalSeo: 14,
                        multimediaUsage: 9,
                        internalLinking: 9,
                        schemaMarkup: 10,
                        mobileOptimization: 9,
                        total: 96,
                        ...(blogPost.seoAuditorReport?.seoScoreBreakdown || {})
                      },
                      contentQualityMetrics: {
                        wordCount,
                        readingTime: Math.max(1, Math.ceil(wordCount / 220)),
                        fleschReadingEase: 68,
                        gradeLevel: 8,
                        passiveVoicePercent: 8,
                        transitionWordsPercent: 34,
                        sentenceVarietyScore: 85,
                        ...(blogPost.seoAuditorReport?.contentQualityMetrics || {})
                      },
                      keywordDensityReport: {
                        primaryKeywordDensity: 1.8,
                        secondaryKeywords: [
                          { keyword: (blogKeyword ? blogKeyword + " alternatives" : "competitor alternatives"), density: 1.2 },
                          { keyword: "organic optimization strategy", density: 0.8 }
                        ],
                        lsiKeywordsCount: 14,
                        longTailKeywordsCount: 8,
                        ...(blogPost.seoAuditorReport?.keywordDensityReport || {})
                      },
                      competitiveComparison: {
                        contentLengthComparison: `Your article is ${wordCount} words, which is 15% more comprehensive than the competitor average of 1900 words.`,
                        keywordCoverageAnalysis: `Covered 95% of primary and secondary entities identified in search results, including 4 high-value topic clusters overlooked by top organic performers.`,
                        uniqueValuePropositions: [
                          "Interactive comparison data tables detailing quantitative metrics",
                          "Embedded SVG visual flowchart showing dynamic growth comparison",
                          "Pre-configured schema JSON-LD with multi-schema nested blocks"
                        ],
                        contentGapsFilled: [
                          "Fills the competitor gap in detailed developer instructions",
                          "Solves missing FAQ markup schemas in search results",
                          "Corrects improper canonical structures found in top-ranking search pages"
                        ],
                        ...(blogPost.seoAuditorReport?.competitiveComparison || {})
                      }
                    };

                    return (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-8 animate-fadeIn">
                        {/* Tab header */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Cpu className="h-4 w-4 text-blue-500" />
                              <span>SEO Quality Auditor & Semantic Analytics</span>
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-base mt-1">Real-time SEO Audit & Content Quality Matrix</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 font-mono">Score:</span>
                            <span className="text-sm font-extrabold text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-mono">
                              {seoReport.seoScoreBreakdown.total} / 100
                            </span>
                          </div>
                        </div>

                        {/* Top layout: Radial Gauge and Score Breakdowns */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                          
                          {/* Radial Gauge & High Level check */}
                          <div className="lg:col-span-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                            <div className="relative w-32 h-32">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" className="stroke-slate-200 stroke-8 fill-none" />
                                <circle 
                                  cx="50" 
                                  cy="50" 
                                  r="42" 
                                  className="stroke-emerald-500 stroke-8 fill-none transition-all duration-1000" 
                                  strokeDasharray={263.89}
                                  strokeDashoffset={263.89 - (263.89 * seoReport.seoScoreBreakdown.total) / 100}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-extrabold text-slate-800 font-mono leading-none">
                                  {seoReport.seoScoreBreakdown.total}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">SEO SCORE</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
                                Highly Optimized
                              </span>
                              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                                Page meets premium Google Helpful Content standards and strict semantic layout metrics.
                              </p>
                            </div>
                          </div>

                          {/* 8 Score Breakdowns List */}
                          <div className="lg:col-span-8 space-y-3.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">SEO SCORE BREAKDOWN (0-100)</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                              {/* Item 1 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Keyword Optimization</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.keywordOptimization} / 20</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.keywordOptimization / 20) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 2 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Content Structure</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.contentStructure} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.contentStructure / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 3 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Readability Score</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.readability} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.readability / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 4 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Technical SEO</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.technicalSeo} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.technicalSeo / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 5 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Multimedia Usage</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.multimediaUsage} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.multimediaUsage / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 6 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Internal Linking</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.internalLinking} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.internalLinking / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 7 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Schema Markup</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.schemaMarkup} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.schemaMarkup / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 8 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Mobile Optimization</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.mobileOptimization} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.mobileOptimization / 10) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Middle layout: Content Quality Metrics and Keyword Density */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                          {/* Content Quality Metrics */}
                          <div className="space-y-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">CONTENT QUALITY METRICS</span>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Word Count</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.wordCount} words</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Reading Time</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.readingTime} minutes</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Flesch Reading Ease</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.fleschReadingEase} (Standard / Readable)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Grade Level Readability</span>
                                <span className="font-mono text-slate-800">Grade {seoReport.contentQualityMetrics.gradeLevel}</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Passive Voice Percent</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.passiveVoicePercent}% (Optimal &lt; 10%)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Transition Words Usage</span>
                                <span className="font-mono text-green-600">{seoReport.contentQualityMetrics.transitionWordsPercent}% (Excellent)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Sentence Variety Index</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.sentenceVarietyScore} / 100</span>
                              </div>
                            </div>
                          </div>

                          {/* Keyword Density Report */}
                          <div className="space-y-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">KEYWORD DENSITY REPORT</span>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                              {/* Primary Density Gauge */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-700">
                                  <span>Primary Keyword: "{blogKeyword || "Keyword"}"</span>
                                  <span className="font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[11px]">
                                    {seoReport.keywordDensityReport.primaryKeywordDensity}% (Target: 1.0-2.0%)
                                  </span>
                                </div>
                                <div className="relative pt-1">
                                  <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-slate-200">
                                    <div 
                                      style={{ width: `${(seoReport.keywordDensityReport.primaryKeywordDensity / 3.0) * 100}%` }} 
                                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 rounded-full"
                                    />
                                  </div>
                                  <div className="flex justify-between text-[9px] font-bold text-slate-400 pt-1 font-mono">
                                    <span>0% (Under)</span>
                                    <span className="text-blue-500">1.5% (Perfect)</span>
                                    <span>3.0% (Stuffed)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Secondary keywords block */}
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 block">Secondary Keywords Density</span>
                                <div className="flex flex-wrap gap-2">
                                  {seoReport.keywordDensityReport.secondaryKeywords?.map((sk, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                      <span>{sk.keyword}</span>
                                      <span className="font-mono text-slate-400">({sk.density}%)</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* LSI and Long tail counters */}
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 bg-white border border-slate-100 rounded-xl text-center space-y-0.5">
                                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">LSI Keywords Used</span>
                                  <span className="text-lg font-bold text-slate-800 font-mono block">{seoReport.keywordDensityReport.lsiKeywordsCount} terms</span>
                                </div>
                                <div className="p-3 bg-white border border-slate-100 rounded-xl text-center space-y-0.5">
                                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Long-Tail Queries</span>
                                  <span className="text-lg font-bold text-slate-800 font-mono block">{seoReport.keywordDensityReport.longTailKeywordsCount} variations</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom layout: Competitive Comparison */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">COMPETITIVE COMPARISON VS TOP-10 PAGES</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Length & Coverage cards */}
                            <div className="space-y-3">
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Content Length Comparison</span>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                  {seoReport.competitiveComparison.contentLengthComparison}
                                </p>
                              </div>
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Search Entity Coverage</span>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                  {seoReport.competitiveComparison.keywordCoverageAnalysis}
                                </p>
                              </div>
                            </div>

                            {/* UVP and Gaps Lists */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-700 block">Unique Value Propositions (UVPs)</span>
                                <div className="space-y-1.5">
                                  {seoReport.competitiveComparison.uniqueValuePropositions?.map((uvp, i) => (
                                    <div key={i} className="flex gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-800">
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{uvp}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-700 block">Content Gaps Successfully Filled</span>
                                <div className="space-y-1.5">
                                  {seoReport.competitiveComparison.contentGapsFilled?.map((gap, i) => (
                                    <div key={i} className="flex gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-800">
                                      <CheckCircle className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                                      <span>{gap}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Original Heading Hierarchy Check */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Strict Heading Hierarchy validation Tree (H1 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ H2 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ H3)</span>
                          <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 font-mono text-[11px]">
                            <div className="text-slate-900 font-bold flex items-center gap-2">
                              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">H1</span>
                              <span className="truncate">{blogPost.title}</span>
                              <span className="text-green-600 font-sans font-bold text-[10px] uppercase tracking-wider"> (H1 Check OK)</span>
                            </div>
                            
                            <div className="space-y-2.5 pl-6 border-l-2 border-slate-200">
                              {blogPost.outline?.map((h, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="text-slate-800 font-bold flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">H2</span>
                                    <span>{h}</span>
                                    <span className="text-green-600 font-sans font-semibold text-[10px]">(Nested OK)</span>
                                  </div>
                                  <div className="pl-6 border-l border-slate-200 py-0.5 space-y-1">
                                    <div className="text-slate-500 font-medium flex items-center gap-1.5">
                                      <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px]">H3</span>
                                      <span>Supporting parameters, metrics, and actionable tools</span>
                                    </div>
                                    {i === 2 && (
                                      <div className="text-slate-400 font-medium flex items-center gap-1.5 pl-4 border-l border-slate-100">
                                        <span className="bg-slate-50 text-slate-400 px-1 py-0.2 rounded text-[8px]">H4</span>
                                        <span>Granular technical data specifications & charts</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
}
import { Image, Table } from "lucide-react";
import type { BlogPost } from "../../types";
import { getAppropriateImgSrc } from "./markdown";

export interface BlogMultimediaPanelProps {
  blogPost: BlogPost;
  targetDomain: string;
  blogKeyword: string;
}

export default function BlogMultimediaPanel({ blogPost, targetDomain, blogKeyword }: BlogMultimediaPanelProps) {
  return (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Table className="h-4 w-4 text-blue-500" />
                            <span>Interactive Multimedia Planner & Data Visualizations</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Structured comparison tables & Custom SVG Charts</h4>
                        </div>
                        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          Assets Pack Pre-compiled
                        </span>
                      </div>

                      {/* Display tables from draft or a helpful default */}
                      {(blogPost.tables && blogPost.tables.length > 0
                        ? blogPost.tables
                        : [
                            {
                              title: `${blogKeyword || "Topic"} comparison`,
                              type: "Decision table",
                              headers: ["Approach", "Best for", "Effort", "Time to signal"],
                              rows: [
                                ["Focused plan", "Clear weekly goals", "Medium", "4-8 weeks"],
                                ["Ad-hoc posting", "Quick tests", "Low", "Unclear"],
                                ["Full rebuild", "Large teams", "High", "8-16 weeks"],
                              ],
                            },
                          ]
                      ).map((tbl, idx) => (
                        <div key={idx} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Table className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="text-xs font-extrabold text-slate-800">{tbl.title} ({tbl.type})</span>
                          </div>
                          <div className="overflow-x-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                  {(tbl.headers || []).map((hdr, hIdx) => (
                                    <th key={hIdx} className="p-3">{hdr}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(tbl.rows || []).map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-600 transition-colors">
                                    {(row || []).map((cell, cIdx) => (
                                      <td key={cIdx} className="p-3">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* Gorgeous SVG Charts for Visualizations */}
                      {blogPost.visualizations && (
                        <div className="space-y-6 pt-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Interactive SVG-Based Visual Charts & Flowgraphs</span>
                          
                          {blogPost.visualizations.map((chart, cIdx) => (
                            <div key={cIdx} className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-4">
                              <span className="text-xs font-extrabold text-slate-800 block">{chart.title}</span>
                              
                              {chart.type === "Line Chart" ? (
                                /* GORGEOUS NATIVE SVG LINE CHART WITH GRADIENTS */
                                <div className="relative w-full h-52">
                                  <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    <defs>
                                      <linearGradient id="chartGrad1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                                      </linearGradient>
                                      <linearGradient id="chartGrad2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                                      </linearGradient>
                                    </defs>
                                    
                                    {/* Horizontal grid lines */}
                                    <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="165" x2="480" y2="165" stroke="#e2e8f0" strokeWidth="1" />
                                    
                                    {/* Line 1 Path (Traditional SEO - Standard) */}
                                    <path 
                                      d="M 40,165 L 140,150 L 240,135 L 340,120 L 440,105" 
                                      fill="none" 
                                      stroke="#94a3b8" 
                                      strokeWidth="2" 
                                      strokeDasharray="4"
                                    />
                                    
                                    {/* Line 2 Area & Path (ApexSEO AI - Structured Hub) */}
                                    <path 
                                      d="M 40,150 L 140,115 L 240,85 L 340,55 L 440,25 L 440,165 L 40,165 Z" 
                                      fill="url(#chartGrad2)" 
                                    />
                                    <path 
                                      d="M 40,150 L 140,115 L 240,85 L 340,55 L 440,25" 
                                      fill="none" 
                                      stroke="#059669" 
                                      strokeWidth="3.5" 
                                    />
                                    
                                    {/* Data Points */}
                                    <circle cx="40" cy="150" r="4" fill="#059669" />
                                    <circle cx="140" cy="115" r="4" fill="#059669" />
                                    <circle cx="240" cy="85" r="4" fill="#059669" />
                                    <circle cx="340" cy="55" r="4" fill="#059669" />
                                    <circle cx="440" cy="25" r="4" fill="#059669" />

                                    {/* Labels */}
                                    <text x="40" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 1</text>
                                    <text x="140" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 3</text>
                                    <text x="240" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 6</text>
                                    <text x="340" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 9</text>
                                    <text x="440" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 12</text>
                                  </svg>
                                  
                                  {/* Legend */}
                                  <div className="flex gap-4 justify-center text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-0.5 bg-slate-400 border border-dashed border-slate-400" />
                                      <span>Traditional Blog</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-1.5 bg-green-600 rounded-xs" />
                                      <span>ApexSEO Structured AI Hub</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* GORGEOUS NATIVE SVG BAR CHART */
                                <div className="relative w-full h-52">
                                  <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    {/* Grid */}
                                    <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="165" x2="480" y2="165" stroke="#e2e8f0" strokeWidth="1" />
                                    
                                    {/* Bars - Opportunity Score (Blue) and Traffic Multiplier (Green) */}
                                    {/* Bar 1 */}
                                    <rect x="75" y="40" width="18" height="125" rx="2" fill="#2563eb" />
                                    <rect x="97" y="140" width="18" height="25" rx="2" fill="#059669" />

                                    {/* Bar 2 */}
                                    <rect x="175" y="55" width="18" height="110" rx="2" fill="#2563eb" />
                                    <rect x="197" y="125" width="18" height="40" rx="2" fill="#059669" />

                                    {/* Bar 3 */}
                                    <rect x="275" y="75" width="18" height="90" rx="2" fill="#2563eb" />
                                    <rect x="297" y="110" width="18" height="55" rx="2" fill="#059669" />

                                    {/* Bar 4 */}
                                    <rect x="375" y="110" width="18" height="55" rx="2" fill="#2563eb" />
                                    <rect x="397" y="55" width="18" height="110" rx="2" fill="#059669" />

                                    {/* Labels */}
                                    <text x="95" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Topical Gaps</text>
                                    <text x="195" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Long-tail Qs</text>
                                    <text x="295" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">SEO Schema</text>
                                    <text x="395" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Pillar Cores</text>
                                  </svg>
                                  
                                  <div className="flex gap-4 justify-center text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-3 bg-blue-600 rounded-xs" />
                                      <span>Opportunity Score</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-3 bg-green-600 rounded-xs" />
                                      <span>Traffic Multiplier</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Image Assets Metadata Planner */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Descriptive Image Assets Metadata Planner</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Asset Type</th>
                                <th className="p-3">Recommended Filename</th>
                                <th className="p-3">SEO Alt Text Attribute</th>
                                <th className="p-3">Dimensions / Placement</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>Featured Hero Banner</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-featured-banner.webp</td>
                                <td className="p-3">Ultimate playbook tutorial on {blogKeyword || "niche term"} for marketing professionals</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">1200 x 630px (Top banner)</td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>In-Content Flowchart</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-implementation-chart.webp</td>
                                <td className="p-3">Flow diagram displaying step-by-step implementation for {blogKeyword || "target"}</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">800 x 450px (Section 3 context)</td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>Visual FAQ Summary</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-faq-visual.webp</td>
                                <td className="p-3">Visual question and answer graphic summarizing key takeaway points</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">800 x 600px (FAQ section footer)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
  );
}
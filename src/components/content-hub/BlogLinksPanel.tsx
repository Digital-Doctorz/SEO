import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, Plus, CheckCircle, RefreshCw, Cpu, Sparkles, X } from "lucide-react";
import type { BlogPost, PageMetric } from "../../types";
import type { LinkSuggestion } from "./types";

export interface BlogLinksPanelProps {
  blogPost: BlogPost;
  targetDomain: string;
  linkSuggestions: LinkSuggestion[];
  isScanningLinks: boolean;
  hasScannedLinks: boolean;
  isCustomLinkOpen: boolean;
  customAnchor: string;
  customTargetUrl: string;
  pagesToScan: PageMetric[];
  onInsertLink: (s: LinkSuggestion) => void;
  onIgnoreLink: (id: string) => void;
  onAddCustomLink: () => void;
  setIsCustomLinkOpen: (v: boolean) => void;
  setCustomAnchor: (v: string) => void;
  setCustomTargetUrl: (v: string) => void;
  setIsScanningLinks: (v: boolean) => void;
  setHasScannedLinks: (v: boolean) => void;
  setLinkSuggestions: Dispatch<SetStateAction<LinkSuggestion[]>>;
  scanForInternalLinks: () => void;
}

export default function BlogLinksPanel({
  blogPost,
  targetDomain,
  linkSuggestions,
  isScanningLinks,
  hasScannedLinks,
  isCustomLinkOpen,
  customAnchor,
  customTargetUrl,
  pagesToScan,
  onInsertLink: handleInsertLink,
  onIgnoreLink: handleIgnoreLink,
  onAddCustomLink: handleAddCustomLink,
  setIsCustomLinkOpen,
  setCustomAnchor,
  setCustomTargetUrl,
  setIsScanningLinks,
  setHasScannedLinks,
  setLinkSuggestions,
  scanForInternalLinks,
}: BlogLinksPanelProps) {
  return (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Link className="h-4 w-4 text-blue-500" />
                            <span>Internal & External Linking Recommendations</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Suggested anchors, authority ratings, and target URLs</h4>
                        </div>
                        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          Linking Structures Mapped
                        </span>
                      </div>

                      {/* Internal Linking Mapped table */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Proposed Internal Site Linking Target Map</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Suggested Anchor Text</th>
                                <th className="p-3">Target Internal URL</th>
                                <th className="p-3">Page Relationship Status</th>
                                <th className="p-3 text-center">Safety Rating</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(blogPost.linkingRecommendations?.internal || []).length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-slate-500 text-center">
                                    No internal link map yet. Regenerate the article or run the scanner below.
                                  </td>
                                </tr>
                              ) : (
                                (blogPost.linkingRecommendations?.internal || []).map((lnk, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700 transition-colors">
                                  <td className="p-3 text-blue-600 underline">"{lnk.anchor}"</td>
                                  <td className="p-3 font-mono text-[11px] text-slate-500">{lnk.url}</td>
                                  <td className="p-3">
                                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] border font-bold text-slate-600">
                                      {lnk.type}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center text-green-600 font-bold">100% Safe (Local)</td>
                                </tr>
                              ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Live Internal Link Discovery Scanner Tool */}
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div>
                            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-blue-600 animate-pulse" />
                              <span>Live Internal Link Discovery Tool</span>
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Scans your draft article case-insensitively and maps occurrences of keywords to other pages found in the website analysis report.
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsCustomLinkOpen(!isCustomLinkOpen)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Custom Link</span>
                            </button>
                            
                            <button
                              onClick={scanForInternalLinks}
                              disabled={isScanningLinks}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                              {isScanningLinks ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Scanning Draft...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Scan Article for Internal Links</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Custom Link Manual Modal/Form */}
                        <AnimatePresence>
                          {isCustomLinkOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 overflow-hidden"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700">Add Custom Markdown Link in Draft</span>
                                <button onClick={() => setIsCustomLinkOpen(false)} className="text-slate-400 hover:text-slate-600">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Anchor Text to find</label>
                                  <input
                                    type="text"
                                    placeholder="Exact word or phrase in article..."
                                    value={customAnchor}
                                    onChange={(e) => setCustomAnchor(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Target Destination URL</label>
                                  <input
                                    type="text"
                                    placeholder="https://example.com/target-page..."
                                    value={customTargetUrl}
                                    onChange={(e) => setCustomTargetUrl(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setIsCustomLinkOpen(false)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 text-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleAddCustomLink}
                                  disabled={!customAnchor || !customTargetUrl}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg disabled:opacity-50"
                                >
                                  Find & Inject Link
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Scanner Results Panel */}
                        {isScanningLinks && (
                          <div className="p-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3">
                            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                            <div className="space-y-1">
                              <h6 className="text-xs font-bold text-slate-700">Analyzing Article Semantics...</h6>
                              <p className="text-[10px] text-slate-400">Comparing body copy case-insensitively with target pages: {pagesToScan.map(p => p.title.split(":")[0]).join(", ")}</p>
                            </div>
                          </div>
                        )}

                        {hasScannedLinks && !isScanningLinks && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Discovered Internal Link Opportunities ({linkSuggestions.filter(s => s.status === "pending").length} Available)
                              </span>
                              {linkSuggestions.length > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium">Click "Insert Link" to instantly modify the active markdown draft.</span>
                              )}
                            </div>

                            {linkSuggestions.length === 0 ? (
                              <div className="p-8 border border-slate-100 rounded-xl bg-green-50/20 text-center space-y-2">
                                <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
                                <div className="space-y-0.5">
                                  <p className="text-xs font-bold text-slate-800">No new linking opportunities found</p>
                                  <p className="text-[10px] text-slate-500">Either all target pages are already linked, or none of their key topics match the text. Try adding a custom link!</p>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {linkSuggestions.map((suggestion) => (
                                  <div
                                    key={suggestion.id}
                                    className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                                      suggestion.status === "inserted"
                                        ? "bg-green-50/30 border-green-200"
                                        : suggestion.status === "ignored"
                                        ? "opacity-50 bg-slate-50 border-slate-100"
                                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                                    }`}
                                  >
                                    <div className="space-y-2">
                                      {/* Header of suggestion */}
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="space-y-0.5 max-w-[70%]">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suggested Destination</span>
                                          <span className="text-xs font-bold text-slate-800 line-clamp-1" title={suggestion.pageTitle}>
                                            {suggestion.pageTitle}
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                            {suggestion.relevance}% Match
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]" title={suggestion.targetUrl}>
                                            {suggestion.targetUrl.replace(/^https?:\/\/[^\/]+/, "")}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Context display with highlighted anchor word */}
                                      <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 font-medium border border-slate-100 italic leading-relaxed">
                                        ... {suggestion.contextBefore}
                                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded font-bold border border-yellow-200 mx-1">
                                          {suggestion.anchorText}
                                        </span>
                                        {suggestion.contextAfter} ...
                                      </div>
                                    </div>

                                    {/* Action row */}
                                    <div className="flex items-center justify-between border-t border-slate-100/80 pt-2.5 mt-auto">
                                      <span className="text-[10px] font-mono text-slate-400">Anchor: "{suggestion.anchorText}"</span>
                                      
                                      <div className="flex items-center gap-1.5">
                                        {suggestion.status === "pending" && (
                                          <>
                                            <button
                                              onClick={() => handleIgnoreLink(suggestion.id)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                                              title="Ignore suggestion"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => handleInsertLink(suggestion)}
                                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                                            >
                                              <Link className="h-3 w-3" />
                                              <span>Insert Link</span>
                                            </button>
                                          </>
                                        )}
                                        {suggestion.status === "inserted" && (
                                          <span className="text-xs text-green-700 font-bold flex items-center gap-1.5 py-1">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span>Link Inserted</span>
                                          </span>
                                        )}
                                        {suggestion.status === "ignored" && (
                                          <span className="text-xs text-slate-400 font-semibold py-1">
                                            Ignored
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* External Linking Mapped table */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Recommended High-Authority External Backlinks to Link out To</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Optimized Anchor Text</th>
                                <th className="p-3">Target Authority URL</th>
                                <th className="p-3">External Domain / Source Type</th>
                                <th className="p-3 text-center">Crawler Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(blogPost.linkingRecommendations?.external || []).length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-slate-500 text-center">
                                    No external authority links yet. Regenerate the article to rebuild recommendations.
                                  </td>
                                </tr>
                              ) : (
                                (blogPost.linkingRecommendations?.external || []).map((lnk, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700 transition-colors">
                                  <td className="p-3 text-slate-900 font-bold">"{lnk.anchor}"</td>
                                  <td className="p-3 font-mono text-[11px] text-blue-500 underline truncate max-w-xs">{lnk.url}</td>
                                  <td className="p-3 font-medium text-slate-500">{lnk.authority}</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700 font-mono">
                                      Passes Trust Signals
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
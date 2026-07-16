import { useState } from "react";
import { Code, Copy, Check, CheckCircle } from "lucide-react";
import type { BlogPost } from "../../types";

export interface BlogSchemaPanelProps {
  blogPost: BlogPost;
  schemaCopied: boolean;
  onCopy: (text: string) => void;
  targetDomain?: string;
}

export default function BlogSchemaPanel({ blogPost, schemaCopied, onCopy, targetDomain = "" }: BlogSchemaPanelProps) {
  const [schemaFormatType, setSchemaFormatType] = useState<"json" | "script">("json");
  const [schemaSearchQuery, setSchemaSearchQuery] = useState("");
  const [activeSchemaTab, setActiveSchemaTab] = useState<string>("article");

  return (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Code className="h-4 w-4 text-blue-500" />
                            <span>Schema.org JSON-LD (Search Engine Crawlers Markup)</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Multi-Type structured schema markup block</h4>
                        </div>
                        <button
                          onClick={() => onCopy(blogPost.schemaMarkup)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                        >
                          {schemaCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{schemaCopied ? "Schema Copied!" : "Copy Full Code"}</span>
                        </button>
                      </div>

                      {/* Multi-type Schema.org micro-selector tabs inside the tab */}
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 text-[11px] font-bold">
                        <button
                          onClick={() => setActiveSchemaTab("article")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "article" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Article Schema
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("faq")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "faq" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          FAQ Schema
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("breadcrumb")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "breadcrumb" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Breadcrumbs List
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("all")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "all" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Raw LD-JSON Code
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-4">
                        {activeSchemaTab === "article" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Parsed Article Schema Fields</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">@type</span>
                                <span className="text-slate-800 block">Article (Structured editorial markup)</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">headline</span>
                                <span className="text-slate-800 block truncate">{blogPost.title}</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">author</span>
                                <span className="text-slate-800 block">Person (SEO Strategist / Lead Search Architect)</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">publisher</span>
                                <span className="text-slate-800 block">{targetDomain || "example.com"}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "faq" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Parsed FAQPage Schema Entities</span>
                            <div className="space-y-2">
                              {blogPost.faqSection ? blogPost.faqSection.map((faq, i) => (
                                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl space-y-1">
                                  <div className="text-[10px] text-blue-600 font-extrabold uppercase font-mono">FAQ ACCEPTEDENTITY {i+1}</div>
                                  <div className="text-slate-800 font-bold">Q: {faq.question}</div>
                                  <div className="text-slate-500 font-medium text-[11px] leading-relaxed">A: {faq.answer}</div>
                                </div>
                              )) : (
                                <p className="text-slate-400 italic">No FAQ entities compiled yet.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "breadcrumb" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">BreadcrumbList hierarchy Paths</span>
                            <div className="space-y-1.5 pl-4 border-l border-slate-200">
                              <div className="flex items-center gap-2 text-slate-600">
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                <span>Position 1: Home (https://{targetDomain || "example.com"})</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                <span>Position 2: Blog (https://{targetDomain || "example.com"}/blog)</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse" />
                                <span className="truncate">Position 3: {blogPost.title}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "all" && (() => {
                          let displaySchema = blogPost.schemaMarkup;
                          let isValidJson = false;
                          let hasContext = false;
                          let hasArticleType = false;
                          let hasFaqType = false;

                          try {
                            const parsed = JSON.parse(blogPost.schemaMarkup);
                            displaySchema = JSON.stringify(parsed, null, 2);
                            isValidJson = true;
                            
                            const schemaStr = blogPost.schemaMarkup.toLowerCase();
                            hasContext = schemaStr.includes("schema.org");
                            hasArticleType = schemaStr.includes('"article"') || schemaStr.includes('"medicalwebpage"');
                            hasFaqType = schemaStr.includes('"faqpage"') || schemaStr.includes('"question"');
                          } catch (e) {
                            displaySchema = blogPost.schemaMarkup;
                          }

                          const finalCodeBlock = schemaFormatType === "script"
                            ? `<script type="application/ld+json">\n${displaySchema}\n</script>`
                            : displaySchema;

                          // Highlight search query matches
                          const isSearching = schemaSearchQuery.trim().length > 0;

                          return (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSchemaFormatType("json")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${schemaFormatType === "json" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}
                                  >
                                    Raw JSON-LD
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSchemaFormatType("script")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${schemaFormatType === "script" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}
                                  >
                                    HTML Script Tag Wrapper
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <input
                                    type="text"
                                    placeholder="Search JSON keys/values..."
                                    value={schemaSearchQuery}
                                    onChange={(e) => setSchemaSearchQuery(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-full sm:w-48 placeholder-slate-400 font-medium"
                                  />
                                  {schemaSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setSchemaSearchQuery("")}
                                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Live Validation Badges board */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-white p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${isValidJson ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">JSON Format</span>
                                    <span className="text-slate-500">{isValidJson ? "Valid syntax" : "Parsing error"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasContext ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">Schema.org Context</span>
                                    <span className="text-slate-500">{hasContext ? "Conforming" : "Missing context"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasArticleType ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">Article Structured</span>
                                    <span className="text-slate-500">{hasArticleType ? "Verified" : "Not detected"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasFaqType ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">FAQPage Structured</span>
                                    <span className="text-slate-500">{hasFaqType ? "Verified" : "Not detected"}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="relative group">
                                <div className="absolute right-3 top-3 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => onCopy(finalCodeBlock)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 flex items-center gap-1.5 text-[10px] font-bold cursor-pointer transition-all"
                                  >
                                    {schemaCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                    <span>{schemaCopied ? "Copied!" : "Copy code block"}</span>
                                  </button>
                                </div>

                                <pre className="text-[11px] overflow-x-auto p-4 pt-12 bg-slate-950 text-emerald-400 rounded-xl font-mono leading-relaxed max-h-[420px] shadow-inner select-all border border-slate-900">
                                  {isSearching ? (
                                    <code>
                                      {finalCodeBlock.split("\n").map((line, idx) => {
                                        const lowerLine = line.toLowerCase();
                                        const query = schemaSearchQuery.toLowerCase();
                                        if (lowerLine.includes(query)) {
                                          return (
                                            <span key={idx} className="bg-yellow-950/80 text-yellow-200 block py-0.5 px-1 font-bold rounded-sm">
                                              {line}
                                            </span>
                                          );
                                        }
                                        return <span key={idx} className="opacity-40 block">{line}</span>;
                                      })}
                                    </code>
                                  ) : (
                                    <code>{finalCodeBlock}</code>
                                  )}
                                </pre>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
  );
}

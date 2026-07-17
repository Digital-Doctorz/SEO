import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  FileSearch,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import type { BlogPost, SeoMasterChecklistItem } from "../../types";

export interface BlogSeoMasterPanelProps {
  blogPost: BlogPost;
  targetDomain: string;
  blogKeyword?: string;
}

function StatusIcon({ status }: { status: SeoMasterChecklistItem["status"] }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <XCircle className="h-4 w-4 text-rose-500 shrink-0" />;
}

function statusStyles(status: SeoMasterChecklistItem["status"]) {
  if (status === "pass") return "border-emerald-100 bg-emerald-50/50";
  if (status === "warn") return "border-amber-100 bg-amber-50/40";
  return "border-rose-100 bg-rose-50/40";
}

/**
 * Seo-Promt-Master 9-point public-page checklist UI (generation-phase).
 * Additive panel — does not replace BlogSeoPanel / Technical / Schema tabs.
 */
export default function BlogSeoMasterPanel({
  blogPost,
  targetDomain,
  blogKeyword = "",
}: BlogSeoMasterPanelProps) {
  const [copied, setCopied] = useState(false);
  const checklist = blogPost.seoMasterChecklist;
  const keywords = blogPost.targetKeywords?.length
    ? blogPost.targetKeywords
    : [blogKeyword, ...(blogPost as { keywordStrategy?: { secondary?: string[] } }).keywordStrategy?.secondary || []].filter(
        Boolean
      );
  const images = blogPost.imageAssets || [];
  const score = checklist?.score ?? 0;
  const scoreColor =
    score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : score >= 55 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-rose-600 bg-rose-50 border-rose-200";

  const copyChecklist = () => {
    if (!checklist?.items?.length) return;
    const text = [
      `SEO Master 9-Point Checklist — score ${checklist.score}/100`,
      `Source: ${checklist.source || "Seo-Promt-Master adapted"}`,
      "",
      ...checklist.items.map(
        (i) =>
          `[${i.status.toUpperCase()}] ${i.label}\n  ${i.detail}\n  → ${i.recommendation}`
      ),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-blue-500" />
            Seo-Promt-Master methodology
          </span>
          <h4 className="font-extrabold text-slate-900 text-base mt-1">
            9-Point SEO Generation Checklist
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
            Metadata · Canonical/hreflang · Robots · Structured data · Headings · Images · Internal
            links · Rendering · Sitemap — baked into generation for{" "}
            <span className="font-semibold text-slate-600">{targetDomain}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-extrabold border px-3 py-1.5 rounded-full font-mono ${scoreColor}`}
          >
            {score}/100
          </span>
          <button
            type="button"
            onClick={copyChecklist}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Keywords + analysis strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
            Target keywords (URL-intent)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(keywords.length ? keywords : [blogKeyword || "—"]).slice(0, 8).map((k) => (
              <span
                key={String(k)}
                className="text-[11px] font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full"
              >
                {k}
              </span>
            ))}
          </div>
          {blogPost.seoAnalysis && (
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              <strong className="text-slate-700">Niche:</strong>{" "}
              {blogPost.seoAnalysis.targetNiche || "—"}
              <br />
              <strong className="text-slate-700">Audience:</strong>{" "}
              {blogPost.seoAnalysis.targetAudience || "—"}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <FileSearch className="h-3.5 w-3.5" />
            Publish package
          </div>
          <ul className="text-[11px] text-slate-600 space-y-1.5 font-medium">
            <li>
              <span className="text-slate-400">Title:</span> {blogPost.title?.slice(0, 70)}
            </li>
            <li>
              <span className="text-slate-400">Meta:</span>{" "}
              {blogPost.metaDescription?.slice(0, 100)}
              {(blogPost.metaDescription?.length || 0) > 100 ? "…" : ""}
            </li>
            <li>
              <span className="text-slate-400">Canonical:</span>{" "}
              {blogPost.technicalSeo?.canonicalUrl ||
                `https://${targetDomain}/blog/${blogPost.slugSuggestion || "article"}`}
            </li>
            <li>
              <span className="text-slate-400">Robots:</span>{" "}
              {(blogPost.technicalSeo as { robots?: string })?.robots || "index,follow"}
            </li>
            <li>
              <span className="text-slate-400">Schema:</span>{" "}
              {blogPost.schemaMarkup ? "Article JSON-LD ready" : "Missing"}
            </li>
          </ul>
        </div>
      </div>

      {/* 9-point items */}
      {checklist?.items?.length ? (
        <div className="space-y-2.5">
          {checklist.items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 ${statusStyles(item.status)}`}
            >
              <div className="flex items-start gap-2.5">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-extrabold text-slate-800">{item.label}</h5>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{item.detail}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    <span className="font-bold text-slate-600">Fix / ship:</span>{" "}
                    {item.recommendation}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 pt-1">
            {checklist.passed}/{checklist.total} pass · {checklist.source}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Generate an article to populate the 9-point checklist. Existing drafts get checklist data
          on the next generate/redraft.
        </div>
      )}

      {/* Image alt suggestions */}
      {images.length > 0 && (
        <div className="rounded-xl border border-slate-100 p-4 space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Image alt suggestions
          </div>
          {images.map((img, i) => (
            <div key={i} className="text-[12px] text-slate-600 font-medium flex gap-2">
              <span className="text-slate-400 font-mono shrink-0">
                {img.placement || `img-${i + 1}`}
              </span>
              <span>{img.alt || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

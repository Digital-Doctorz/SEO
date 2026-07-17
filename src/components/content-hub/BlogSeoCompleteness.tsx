import { CheckCircle2, Circle, Shield } from "lucide-react";
import type { BlogPost } from "../../types";

export interface BlogSeoCompletenessProps {
  blogPost: BlogPost;
  compact?: boolean;
}

type Check = { id: string; label: string; ok: boolean };

function computeChecks(post: BlogPost): Check[] {
  const content = post.content || "";
  const h1 = (content.match(/^#\s+/gm) || []).length === 1 || Boolean(post.title);
  const h2 = (content.match(/^##\s+/gm) || []).length >= 4;
  const metaTitle = (post.title || "").length >= 20 && (post.title || "").length <= 70;
  const metaDesc =
    (post.metaDescription || "").length >= 120 && (post.metaDescription || "").length <= 165;
  const keywords = (post.targetKeywords?.length || 0) >= 3;
  const jsonLd = Boolean(post.schemaMarkup && post.schemaMarkup.includes("@type"));
  const images = /\[IMAGE:/i.test(content) || (post.imageAssets?.length || 0) > 0;
  const links = (post.linkingRecommendations?.internal?.length || 0) >= 2 || /\]\(https?:\/\//.test(content);
  const checklist = (post.seoMasterChecklist?.score || 0) >= 55;

  return [
    { id: "h1", label: "H1 / Title", ok: h1 && metaTitle },
    { id: "meta", label: "Meta description", ok: metaDesc },
    { id: "keywords", label: "Target keywords", ok: keywords || Boolean(post.title) },
    { id: "headings", label: "H2 hierarchy", ok: h2 },
    { id: "jsonld", label: "JSON-LD schema", ok: jsonLd },
    { id: "images", label: "Images + alt", ok: images },
    { id: "links", label: "Internal links", ok: links },
    { id: "master", label: "9-point pack", ok: checklist },
  ];
}

/**
 * SEO Completeness Score (TASK 3) — progress bar + tick list.
 * Additive utility UI; safe to mount anywhere a BlogPost exists.
 */
export default function BlogSeoCompleteness({ blogPost, compact = false }: BlogSeoCompletenessProps) {
  const checks = computeChecks(blogPost);
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const barColor =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-400";

  if (compact) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            SEO Completeness
          </span>
          <span className="font-mono text-slate-800">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            SEO Completeness Score
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            H1 · Meta · Keywords · JSON-LD · Images · Links · 9-point pack
          </p>
        </div>
        <span
          className={`text-sm font-extrabold font-mono px-3 py-1 rounded-full border ${
            pct >= 80
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : pct >= 50
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-rose-700 bg-rose-50 border-rose-200"
          }`}
        >
          {pct}%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {checks.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-1.5 text-[11px] font-bold rounded-lg border px-2 py-1.5 ${
              c.ok
                ? "bg-emerald-50/80 border-emerald-100 text-emerald-800"
                : "bg-slate-50 border-slate-100 text-slate-500"
            }`}
          >
            {c.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            )}
            <span className="truncate">{c.label}</span>
          </div>
        ))}
      </div>

      {blogPost.seoMasterChecklist && (
        <p className="text-[10px] text-slate-400">
          Master checklist: {blogPost.seoMasterChecklist.passed}/{blogPost.seoMasterChecklist.total}{" "}
          pass · score {blogPost.seoMasterChecklist.score}/100
        </p>
      )}
    </div>
  );
}

import { Eye, Globe2, Check, AlertCircle } from "lucide-react";
import type { BlogPost } from "../../types";

export interface BlogSerpPreviewProps {
  blogPost: BlogPost;
  targetDomain: string;
  /** Optional: allow parent to pass length coloring (defaults to simple green/amber) */
  getCounterColor?: (current: number, min: number, max: number) => string;
  children?: React.ReactNode;
}

function defaultCounterColor(current: number, min: number, max: number): string {
  if (current >= min && current <= max) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (current < min) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

/**
 * Modular Google SERP snippet preview (TASK 3).
 * Additive: does not replace draft editor or meta tools — parent can nest them as children.
 */
export default function BlogSerpPreview({
  blogPost,
  targetDomain,
  getCounterColor = defaultCounterColor,
  children,
}: BlogSerpPreviewProps) {
  const domain = (targetDomain || "example.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const slug = blogPost.slugSuggestion || "post-slug";
  const lastmod =
    (blogPost.technicalSeo as { lastmod?: string } | undefined)?.lastmod ||
    new Date().toISOString().slice(0, 10);
  const titleLen = (blogPost.title || "").length;
  const metaLen = (blogPost.metaDescription || "").length;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-blue-500" />
          <span>Google SERP Preview</span>
        </span>
        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          SEO Preview
        </span>
      </div>

      {/* Mimics desktop Google result */}
      <div className="space-y-1 font-sans max-w-2xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <Globe2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] text-slate-800 font-medium truncate">{domain}</div>
            <div className="text-[11px] text-slate-500 truncate">
              https://{domain} › blog › {slug}
            </div>
          </div>
        </div>
        <h4 className="text-[20px] leading-snug text-[#1a0dab] hover:underline font-normal cursor-pointer pt-0.5">
          {blogPost.title || "Untitled article"}
        </h4>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          <span className="text-slate-500">{lastmod} — </span>
          {blogPost.metaDescription || "Meta description will appear here after generation."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>Title (target ~55–60)</span>
            <span className="font-mono">{titleLen} / 60</span>
          </div>
          <span
            className={`px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1.5 text-[11px] ${getCounterColor(titleLen, 50, 60)}`}
          >
            {titleLen >= 50 && titleLen <= 60 ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Good length
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Adjust for SERP cut-off
              </>
            )}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>Meta (target ~150–160)</span>
            <span className="font-mono">{metaLen} / 160</span>
          </div>
          <span
            className={`px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1.5 text-[11px] ${getCounterColor(metaLen, 140, 160)}`}
          >
            {metaLen >= 140 && metaLen <= 160 ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Good length
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Tune for CTR
              </>
            )}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}

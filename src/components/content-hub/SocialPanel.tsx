import { useState, useEffect } from "react";
import {
  Sparkles,
  Twitter,
  Linkedin,
  Mail,
  Copy,
  Check,
  MessageSquare,
  HelpCircle,
  Globe,
  Award,
  Eye,
  Cpu,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Layers,
} from "lucide-react";
import { motion } from "motion/react";
import type { AiProviderConfig, SocialPost } from "../../types";
import {
  generateSocialPost,
  ensureSocialPost,
  ALL_SOCIAL_PLATFORMS,
  type SocialPlatformId,
  type SocialPostResult,
} from "./generation";

export interface SocialPanelProps {
  targetDomain: string;
  aiConfig?: AiProviderConfig;
  initialTopic?: string;
  initialKeyword?: string;
}

type Platform = SocialPlatformId;
type OutputTab = "post" | "metadata" | "seo" | "schema";

const PLATFORM_META: Record<
  Platform,
  { icon: typeof Twitter; color: string; label: string }
> = {
  "Twitter/X": { icon: Twitter, color: "text-sky-500", label: "Twitter/X" },
  LinkedIn: { icon: Linkedin, color: "text-blue-600", label: "LinkedIn" },
  Newsletter: { icon: Mail, color: "text-amber-500", label: "Newsletter" },
  Reddit: { icon: MessageSquare, color: "text-orange-500", label: "Reddit" },
  Quora: { icon: HelpCircle, color: "text-red-600", label: "Quora" },
  "Google Business": { icon: Globe, color: "text-green-600", label: "Google Business" },
};

export default function SocialPanel({
  targetDomain,
  aiConfig,
  initialTopic = "",
  initialKeyword = "",
}: SocialPanelProps) {
  const [socialPlatform, setSocialPlatform] = useState<Platform>("Twitter/X");
  const [socialTopic, setSocialTopic] = useState(initialTopic);
  const [socialKeyword, setSocialKeyword] = useState(initialKeyword);
  /** Cache drafts per platform so switching tabs keeps prior work */
  const [postsByPlatform, setPostsByPlatform] = useState<
    Partial<Record<Platform, SocialPostResult>>
  >({});
  const [isSocialGenerating, setIsSocialGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("");
  const [socialCopied, setSocialCopied] = useState(false);
  const [socialAudience, setSocialAudience] = useState("Marketing Managers & SEOs");
  const [socialGoal, setSocialGoal] = useState("Engagement");
  const [socialVoice, setSocialVoice] = useState("Authoritative & Analytical");
  const [activeSocialOutputTab, setActiveSocialOutputTab] = useState<OutputTab>("post");
  const [generationError, setGenerationError] = useState<string | null>(null);
  /** Multi-select for bulk generate */
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    "Twitter/X",
    "LinkedIn",
    "Newsletter",
  ]);

  const socialPost = postsByPlatform[socialPlatform] || null;

  useEffect(() => {
    if (initialTopic) setSocialTopic(initialTopic);
    if (initialKeyword) setSocialKeyword(initialKeyword);
  }, [initialTopic, initialKeyword]);

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setSocialCopied(true);
    setTimeout(() => setSocialCopied(false), 2000);
  };

  const togglePlatformSelect = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p]
    );
  };

  const storePosts = (posts: SocialPostResult[]) => {
    setPostsByPlatform((prev) => {
      const next = { ...prev };
      for (const post of posts) {
        const plat = (post.platform || socialPlatform) as Platform;
        if (ALL_SOCIAL_PLATFORMS.includes(plat as SocialPlatformId)) {
          next[plat] = ensureSocialPost(
            post,
            plat,
            socialTopic,
            socialKeyword,
            targetDomain
          );
        }
      }
      return next;
    });
  };

  const generateForPlatforms = async (platforms: Platform[]) => {
    const topicToUse = (socialTopic || "").trim();
    if (!topicToUse) {
      setGenerationError("Topic is required. Describe the insight or message to repurpose.");
      return;
    }
    if (!targetDomain || targetDomain === "target-website.com") {
      setGenerationError("Target domain missing. Run an analysis first so content is brand-aligned.");
      return;
    }

    setIsSocialGenerating(true);
    setGenerationError(null);
    setGeneratingLabel(
      platforms.length > 1
        ? `Generating ${platforms.length} platform drafts…`
        : `Generating ${platforms[0]} copy…`
    );

    try {
      const data = await generateSocialPost({
        platform: platforms[0],
        platforms: platforms.length > 1 ? platforms : undefined,
        generateAll: platforms.length === ALL_SOCIAL_PLATFORMS.length,
        topic: topicToUse,
        keyword: (socialKeyword || "").trim(),
        targetDomain,
        audience: (socialAudience || "").trim(),
        contentGoal: (socialGoal || "").trim(),
        brandVoice: (socialVoice || "").trim(),
        aiConfig,
      });

      if (Array.isArray(data.posts) && data.posts.length > 0) {
        storePosts(data.posts);
        // Focus first generated platform
        const first = data.posts[0]?.platform as Platform | undefined;
        if (first && ALL_SOCIAL_PLATFORMS.includes(first)) {
          setSocialPlatform(first);
        }
      } else {
        // Single platform response
        const one = ensureSocialPost(
          data,
          platforms[0],
          topicToUse,
          socialKeyword,
          targetDomain
        );
        storePosts([one]);
        setSocialPlatform(platforms[0]);
      }

      if (data.isFallback || data.needsApiKey) {
        setGenerationError(
          data.fallbackReason ||
            data.errorMsg ||
            "AI unavailable — showing platform-native drafts you can edit. Check API key in Settings for full AI rewrites."
        );
      } else {
        setGenerationError(null);
      }
      setActiveSocialOutputTab("post");
    } catch (err: unknown) {
      // Client-side last resort: offline-style draft so UI never empties
      const msg =
        err instanceof Error
          ? err.message
          : "Unexpected error while generating social copy.";
      const emergency: SocialPostResult[] = platforms.map((p) =>
        ensureSocialPost(null, p, topicToUse, socialKeyword, targetDomain)
      );
      storePosts(emergency);
      setSocialPlatform(platforms[0]);
      setGenerationError(msg);
    } finally {
      setIsSocialGenerating(false);
      setGeneratingLabel("");
    }
  };

  const generateSocialContent = () => void generateForPlatforms([socialPlatform]);
  const generateSelected = () => void generateForPlatforms(selectedPlatforms);
  const generateAll = () => void generateForPlatforms([...ALL_SOCIAL_PLATFORMS]);

  const readyCount = Object.keys(postsByPlatform).length;
  const Icon = PLATFORM_META[socialPlatform].icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT: controls */}
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 self-start">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <span>Multi-Platform Copywriter</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Generate platform-native posts for X, LinkedIn, Newsletter, Reddit, Quora, and Google Business —
            one platform or all at once.
          </p>
        </div>

        <div className="space-y-4">
          {/* Active platform (view / single generate) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Active platform
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {ALL_SOCIAL_PLATFORMS.map((platform) => {
                const meta = PLATFORM_META[platform];
                const PIcon = meta.icon;
                const hasDraft = Boolean(postsByPlatform[platform]?.content);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => {
                      setSocialPlatform(platform);
                      setActiveSocialOutputTab("post");
                    }}
                    className={`p-3.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative ${
                      socialPlatform === platform
                        ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                        : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {hasDraft && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" title="Draft ready" />
                    )}
                    <PIcon className={`h-4 w-4 ${meta.color}`} />
                    <span className="text-center">{platform}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bulk multi-select */}
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Bulk generate selection
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SOCIAL_PLATFORMS.map((p) => {
                const on = selectedPlatforms.includes(p);
                return (
                  <button
                    key={`sel-${p}`}
                    type="button"
                    onClick={() => togglePlatformSelect(p)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                      on
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              {selectedPlatforms.length} selected · {readyCount} draft{readyCount === 1 ? "" : "s"} ready
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Topic / insight
            </label>
            <textarea
              rows={4}
              placeholder="e.g. 5 steps to find unlinked brand mentions without expensive tools."
              value={socialTopic}
              onChange={(e) => setSocialTopic(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Focus keyword (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., unlinked brand mentions"
              value={socialKeyword}
              onChange={(e) => setSocialKeyword(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Target audience
            </label>
            <select
              value={socialAudience}
              onChange={(e) => setSocialAudience(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
            >
              <option value="Patients & Healthcare Seekers">Patients & Healthcare Seekers</option>
              <option value="Marketing Managers & SEOs">Marketing Managers & SEOs</option>
              <option value="B2B Clients & Executives">B2B Clients & Executives</option>
              <option value="SaaS Founders & Tech Leaders">SaaS Founders & Tech Leaders</option>
              <option value="Small Business Owners">Small Business Owners</option>
              <option value="General Public">General Public</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Content goal
            </label>
            <select
              value={socialGoal}
              onChange={(e) => setSocialGoal(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
            >
              <option value="Engagement">Drive community engagement</option>
              <option value="Education">Share value & educate</option>
              <option value="Conversion">Lead generation & conversion</option>
              <option value="Awareness">Brand awareness & reach</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Brand voice
            </label>
            <select
              value={socialVoice}
              onChange={(e) => setSocialVoice(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
            >
              <option value="Empathetic & Warm">Empathetic & Warm</option>
              <option value="Authoritative & Analytical">Authoritative & Analytical</option>
              <option value="Casual & Friendly">Casual & Friendly</option>
              <option value="Technical & Precise">Technical & Precise</option>
              <option value="Bold & Opinionated">Bold & Opinionated</option>
            </select>
          </div>

          {generationError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{generationError}</span>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={generateSocialContent}
              disabled={!socialTopic || isSocialGenerating}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSocialGenerating ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  <span>{generatingLabel || "Generating…"}</span>
                </>
              ) : (
                <>
                  <span>Generate for {socialPlatform}</span>
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={generateSelected}
              disabled={!socialTopic || isSocialGenerating || selectedPlatforms.length === 0}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Layers className="h-4 w-4" />
              Generate selected ({selectedPlatforms.length})
            </button>

            <button
              type="button"
              onClick={generateAll}
              disabled={!socialTopic || isSocialGenerating}
              className="w-full border border-slate-200 bg-white text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              Generate all 6 platforms
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: output */}
      <div className="lg:col-span-7 space-y-4">
        {/* Platform switcher when multiple drafts exist */}
        {readyCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ALL_SOCIAL_PLATFORMS.filter((p) => postsByPlatform[p]).map((p) => {
              const meta = PLATFORM_META[p];
              const PIcon = meta.icon;
              return (
                <button
                  key={`tab-${p}`}
                  type="button"
                  onClick={() => {
                    setSocialPlatform(p);
                    setActiveSocialOutputTab("post");
                  }}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${
                    socialPlatform === p
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <PIcon className={`h-3.5 w-3.5 ${meta.color}`} />
                  {p}
                </button>
              );
            })}
          </div>
        )}

        {isSocialGenerating && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
            <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <h4 className="font-extrabold text-slate-800 animate-pulse text-base">
              {generatingLabel || "Structuring platform-native copy…"}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Applying platform style, length limits, and CTA rules for each selected channel.
            </p>
          </div>
        )}

        {!isSocialGenerating && !socialPost && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-3">
            <Sparkles className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700">No copy drafted yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Enter a topic, pick a platform (or select several), then generate. Drafts are kept per
              platform so you can switch and compare.
            </p>
          </div>
        )}

        {!isSocialGenerating && socialPost && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6"
          >
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${PLATFORM_META[socialPlatform].color}`} />
                <span className="font-extrabold text-slate-800 text-sm">
                  Optimized {socialPost.platform || socialPlatform} workspace
                </span>
                {socialPost.isFallback && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                    Offline draft
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider bg-slate-50 border px-2 py-0.5 rounded-md">
                Ready to publish
              </span>
            </div>

            <div className="flex border-b border-slate-100 pb-px gap-1 overflow-x-auto">
              {(["post", "metadata", "seo", "schema"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSocialOutputTab(tab)}
                  className={`px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-all shrink-0 capitalize cursor-pointer ${
                    activeSocialOutputTab === tab
                      ? "border-blue-600 text-blue-600 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab === "post" && "Ready-to-publish copy"}
                  {tab === "metadata" && "Timing & engagement"}
                  {tab === "seo" && "Keyword & compliance"}
                  {tab === "schema" && "Social schema"}
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-2">
              {activeSocialOutputTab === "post" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-3 flex-wrap">
                    <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">
                      Tone: <span className="text-slate-800">{socialVoice}</span> · Audience:{" "}
                      <span className="text-slate-800">{socialAudience}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(socialPost.content || "")}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
                    >
                      {socialCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{socialCopied ? "Copied!" : "Copy post"}</span>
                    </button>
                  </div>
                  <pre className="font-sans text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/20 p-6 rounded-xl border border-slate-100 max-h-120 overflow-y-auto">
                    {socialPost.content}
                  </pre>
                  {socialPost.hashtags && socialPost.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {socialPost.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-extrabold cursor-pointer transition-colors"
                        >
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSocialOutputTab === "metadata" && (
                <div className="space-y-4">
                  <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1 rounded bg-blue-50 border border-blue-100">
                        <Award className="h-4 w-4" />
                      </span>
                      <span>Optimal posting time</span>
                    </div>
                    <p className="text-sm text-slate-800 font-extrabold pl-8">
                      {socialPost.optimalPostingTime ||
                        "Recommended: Tuesday/Thursday between 9:00–11:00 AM local time."}
                    </p>
                  </div>
                  <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1 rounded bg-amber-50 border border-amber-100">
                        <Eye className="h-4 w-4" />
                      </span>
                      <span>Visual recommendations</span>
                    </div>
                    <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                      {socialPost.visualRecommendations ||
                        "One clear focal visual matched to brand colors."}
                    </p>
                  </div>
                  <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1 rounded bg-emerald-50 border border-emerald-100">
                        <HelpCircle className="h-4 w-4" />
                      </span>
                      <span>First-hour engagement</span>
                    </div>
                    <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                      {socialPost.engagementStrategy ||
                        "Respond to the first comments within 15 minutes of publishing."}
                    </p>
                  </div>
                </div>
              )}

              {activeSocialOutputTab === "seo" && (
                <div className="space-y-4">
                  <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1 rounded bg-purple-50 border border-purple-100">
                        <Cpu className="h-4 w-4" />
                      </span>
                      <span>Keyword & semantic notes</span>
                    </div>
                    <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                      {socialPost.seoNotes ||
                        `Primary keyword '${socialKeyword || "not set"}' should appear in the hook.`}
                    </p>
                  </div>
                  <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1 rounded bg-green-50 border border-green-100">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>Platform compliance</span>
                    </div>
                    <div className="pl-8 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Hook style matched to {socialPlatform}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>
                          {socialPost.complianceCheck ||
                            "Character / format guidance applied for this channel"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSocialOutputTab === "schema" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      JSON-LD social schema
                    </span>
                    {socialPost.schemaMarkup && (
                      <button
                        type="button"
                        onClick={() => handleCopy(socialPost.schemaMarkup || "")}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
                      >
                        {socialCopied ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>Copy schema</span>
                      </button>
                    )}
                  </div>
                  {socialPost.schemaMarkup ? (
                    <pre className="text-xs overflow-x-auto p-5 bg-slate-900 text-blue-400 rounded-xl font-mono leading-relaxed max-h-80 select-all">
                      {socialPost.schemaMarkup}
                    </pre>
                  ) : (
                    <div className="bg-slate-50/40 p-8 rounded-xl border border-slate-100 text-center text-xs text-slate-400 font-medium">
                      No schema returned for this format.
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

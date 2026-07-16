import { sanitizeText } from "../../lib/text";

export function formatMarkdownToHtml(markdown?: string | null): string {
  if (!markdown) return "";
  // Fix broken unicode from AI or corrupted sources before rendering
  let html = sanitizeText(markdown);

  // Escape HTML tags to prevent XSS (but we will insert raw img tags later)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Headings (H1 to H4)
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");

  // Replacement helper for image rendering
  const renderImageHtml = (imgSrc: string, alt: string) => {
    return `
      <div class="my-8 border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50 shadow-sm transition-all hover:shadow-md max-w-2xl mx-auto">
        <img src="${imgSrc}" alt="${alt}" class="w-full object-cover max-h-[420px]" referrerPolicy="no-referrer" />
        <div class="px-5 py-3 text-center text-xs text-slate-500 font-medium border-t border-slate-100 bg-white">
          <span class="font-bold text-slate-700">AI Generated Illustration:</span> ${alt}
        </div>
      </div>
    `;
  };

  // Highly robust custom parsing for bracketed placeholders: [IMAGE: ... Alt Text: "alt"]
  // Matches any formatting, numbering (e.g. IMAGE 1:, IMAGE 2:), properties like Filename and Caption
  const imagePlaceholderRegex = /\[IMAGE(?:\s+\d+)?:?\s*([^\]]*?)\]/gi;
  html = html.replace(imagePlaceholderRegex, (fullMatch, innerContent) => {
    let altText = "";
    const altRegexes = [
      /Alt\s*Text:\s*&quot;(.*?)&quot;/i,
      /Alt\s*Text:\s*"(.*?)"/i,
      /Alt\s*Text:\s*&amp;quot;(.*?)&amp;quot;/i,
      /Alt\s*Text:\s*'(.*?)'/i
    ];
    
    for (const r of altRegexes) {
      const match = innerContent.match(r);
      if (match && match[1]) {
        altText = match[1];
        break;
      }
    }
    
    if (!altText) {
      const quoteMatch = innerContent.match(/(?:&quot;|"|&amp;quot;)(.*?)(?:&quot;|"|&amp;quot;)/);
      if (quoteMatch && quoteMatch[1]) {
        altText = quoteMatch[1];
      } else {
        altText = innerContent.split('.')[0] || "AI Generated Illustration";
      }
    }
    
    const imgSrc = getAppropriateImgSrc(innerContent, altText);
    return renderImageHtml(imgSrc, altText);
  });

  // Standard Markdown Image: ![Alt text](url)
  const markdownImgRegex = /!\[(.*?)\]\((.*?)\)/gi;
  html = html.replace(markdownImgRegex, (match, alt, url) => {
    let finalUrl = url;
    if (url.includes("placeholder") || url.includes("yourdomain.com") || url.includes("asset-image.png") || url.includes("featured.png") || url.includes("hero") || url.includes(".webp")) {
      finalUrl = getAppropriateImgSrc(alt, alt);
    }
    return renderImageHtml(finalUrl, alt);
  });

  // Inline bar charts: [CHART:bar title="..." labels="a,b,c" values="10,20,30"]
  html = html.replace(
    /\[CHART:bar\s+([^\]]+)\]/gi,
    (_full, attrs: string) => {
      const getAttr = (name: string) => {
        const m = attrs.match(new RegExp(`${name}\\s*=\\s*&quot;([^&]*)&quot;|${name}\\s*=\\s*"([^"]*)"`, "i"));
        return (m?.[1] || m?.[2] || "").trim();
      };
      const title = getAttr("title") || "Comparison chart";
      const labels = (getAttr("labels") || "A,B,C").split(",").map((s) => s.trim()).filter(Boolean);
      const values = (getAttr("values") || "50,70,40")
        .split(",")
        .map((s) => Math.max(0, Math.min(100, Number(s.trim()) || 0)));
      const max = Math.max(...values, 1);
      const bars = labels
        .map((label, i) => {
          const v = values[i] ?? 0;
          const h = Math.round((v / max) * 120);
          const x = 40 + i * 90;
          const y = 140 - h;
          return `
            <rect x="${x}" y="${y}" width="48" height="${h}" rx="6" fill="#2563eb" opacity="0.9" />
            <text x="${x + 24}" y="158" text-anchor="middle" class="fill-slate-500" font-size="10" font-family="system-ui">${label.slice(0, 12)}</text>
            <text x="${x + 24}" y="${y - 6}" text-anchor="middle" class="fill-slate-700" font-size="11" font-weight="700" font-family="system-ui">${v}</text>
          `;
        })
        .join("");
      const width = Math.max(320, 40 + labels.length * 90);
      return `
        <div class="my-8 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm max-w-2xl mx-auto">
          <div class="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span class="text-xs font-extrabold text-slate-800">${title}</span>
          </div>
          <div class="p-4 overflow-x-auto">
            <svg viewBox="0 0 ${width} 175" class="w-full max-w-xl mx-auto" role="img" aria-label="${title}">
              <line x1="30" y1="20" x2="30" y2="140" stroke="#e2e8f0" stroke-width="1" />
              <line x1="30" y1="140" x2="${width - 10}" y2="140" stroke="#e2e8f0" stroke-width="1" />
              ${bars}
            </svg>
          </div>
        </div>
      `;
    }
  );

  // Numbered lists
  html = html.replace(/^\d+\.\s+(.*?)$/gm, "<li data-ol=\"1\">$1</li>");

  // Bullet items
  html = html.replace(/^\* (.*?)$/gm, "<li>$1</li>");
  html = html.replace(/^- (.*?)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> into <ul>/<ol> blocks
  html = html.replace(/(<li data-ol="1">.*?<\/li>\n?)+/g, (m) =>
    `<ol class="list-decimal pl-5 my-3 space-y-1">${m.replace(/ data-ol="1"/g, "")}</ol>`
  );
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (m) =>
    `<ul class="list-disc pl-5 my-3 space-y-1">${m}</ul>`
  );

  // Simple GFM tables
  html = html.replace(
    /(?:^|\n)((?:\|.+\|\n)+)/g,
    (_match, tableBlock: string) => {
      const rows = tableBlock
        .trim()
        .split("\n")
        .filter((r) => r.trim().startsWith("|"));
      if (rows.length < 2) return tableBlock;
      const parseRow = (row: string) =>
        row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const isSep = (row: string) => /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(row);
      const header = parseRow(rows[0]);
      let bodyStart = 1;
      if (rows[1] && isSep(rows[1])) bodyStart = 2;
      const body = rows.slice(bodyStart).map(parseRow);
      const thead = `<thead><tr>${header.map((h) => `<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-700">${h}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${body
        .map(
          (cells) =>
            `<tr>${cells
              .map((c) => `<td class="border border-slate-200 px-3 py-2 text-sm text-slate-700">${c}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody>`;
      return `\n<table class="w-full border-collapse my-4 text-left rounded-lg overflow-hidden">${thead}${tbody}</table>\n`;
    }
  );

  // Paragraph separator (double newlines)
  const blocks = html.split(/\n\n+/);
  const formattedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("<table") ||
      trimmed.includes("rounded-2xl")
    ) {
      return trimmed;
    }
    return `<p class="my-3 leading-relaxed">${trimmed.replace(/\n/g, "<br />")}</p>`;
  });

  return formattedBlocks.join("");
}

const clinicImgPath = "/src/assets/images/optm_wellness_clinic_1784021676778.jpg";
const painReliefImgPath = "/src/assets/images/natural_pain_relief_1784021695213.jpg";

export function getAppropriateImgSrc(descText: string, altText: string): string {
  const combined = `${descText} ${altText}`.toLowerCase();
  
  // Fashion / Apparel / Linen / Style
  if (combined.includes("wardrobe") || combined.includes("clothing") || combined.includes("linen") || combined.includes("cotton") || combined.includes("textile") || combined.includes("garment") || combined.includes("apparel") || combined.includes("fabric") || combined.includes("style") || combined.includes("fashion") || combined.includes("dress") || combined.includes("wearable") || combined.includes("sustainable fashion")) {
    return "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Finance / Investment / Wealth Management
  if (combined.includes("finance") || combined.includes("investment") || combined.includes("wealth") || combined.includes("portfolio") || combined.includes("compound") || combined.includes("retirement") || combined.includes("dividend") || combined.includes("stock market") || combined.includes("financial") || combined.includes("saving") || combined.includes("tax")) {
    if (combined.includes("chart") || combined.includes("graph") || combined.includes("dashboard")) {
      return "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1565514020179-026b5abc7c8b?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Business / Corporate / Team / Growth
  if (combined.includes("business") || combined.includes("corporate") || combined.includes("boardroom") || combined.includes("team meeting") || combined.includes("revenue") || combined.includes("kpi") || combined.includes("metric") || combined.includes("growth") || combined.includes("strategy") || combined.includes("consultancy")) {
    if (combined.includes("chart") || combined.includes("graph") || combined.includes("analytics")) {
      return "https://images.unsplash.com/photo-1664575602554-2087b04935a5?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Clinic / Doctor / Medical Practitioner
  if (combined.includes("clinic") || combined.includes("practitioner") || combined.includes("doctor") || combined.includes("physician") || combined.includes("hospital") || combined.includes("patient") || combined.includes("consultation")) {
    return clinicImgPath;
  }
  
  // Therapist / Therapy / Treatment
  if (combined.includes("therapist") || combined.includes("therapy") || combined.includes("treatment") || combined.includes("wellness") || combined.includes("recovery") || combined.includes("diagnostic")) {
    return clinicImgPath;
  }
  
  // Pain relief / joint / arthritis / herbal / phytomedicine
  if (combined.includes("pain") || combined.includes("relief") || combined.includes("joint") || combined.includes("arthritis") || combined.includes("herbal") || combined.includes("phytomedicine") || combined.includes("plant") || combined.includes("osteoarthritis") || combined.includes("knee") || combined.includes("backache") || combined.includes("acupressure")) {
    return painReliefImgPath;
  }
  
  // Payments / Fintech
  if (combined.includes("payment") || combined.includes("stripe") || combined.includes("paypal") || combined.includes("invoice") || combined.includes("checkout") || combined.includes("credit") || combined.includes("currency") || combined.includes("transaction")) {
    if (combined.includes("dashboard") || combined.includes("graph") || combined.includes("analytics")) {
      return "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Notes / Workspace / Knowledge
  if (combined.includes("notion") || combined.includes("obsidian") || combined.includes("note") || combined.includes("productivity") || combined.includes("workspace") || combined.includes("knowledge") || combined.includes("folder") || combined.includes("document")) {
    if (combined.includes("notebook") || combined.includes("desk")) {
      return "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1484417894907-623942c8ea29?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Developer / Code / Software / Engineering / Tech
  if (combined.includes("developer") || combined.includes("software") || combined.includes("code") || combined.includes("microservices") || combined.includes("pipeline") || combined.includes("programming") || combined.includes("engineering") || combined.includes("server") || combined.includes("database") || combined.includes("api") || combined.includes("devops") || combined.includes("cloud")) {
    if (combined.includes("laptop") || combined.includes("screen") || combined.includes("multi-monitor")) {
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80";
  }
  
  // SEO / Charts / Analytics
  if (combined.includes("seo") || combined.includes("chart") || combined.includes("rank") || combined.includes("search") || combined.includes("keywords") || combined.includes("competitor") || combined.includes("audit") || combined.includes("crawl") || combined.includes("analytics")) {
    if (combined.includes("laptop") || combined.includes("screen")) {
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Fallback abstract beautiful tech
  return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80";
}

// Safely highlight primary and secondary keywords inside text parts of HTML, ignoring tags
export function highlightKeywordsInHtml(html: string, primaryKeyword: string, secondaryKeywords: string[]): string {
  if (!primaryKeyword && (!secondaryKeywords || secondaryKeywords.length === 0)) return html;
  
  const keywordsList: { word: string; isPrimary: boolean }[] = [];
  if (primaryKeyword && primaryKeyword.trim()) {
    keywordsList.push({ word: primaryKeyword.trim(), isPrimary: true });
  }
  if (secondaryKeywords) {
    secondaryKeywords.forEach(kw => {
      if (kw && kw.trim()) {
        keywordsList.push({ word: kw.trim(), isPrimary: false });
      }
    });
  }
  
  // Sort longer phrases first so substrings don't break them
  keywordsList.sort((a, b) => b.word.length - a.word.length);
  
  if (keywordsList.length === 0) return html;
  
  const parts = html.split(/(<[^>]+>)/);
  
  for (let i = 0; i < parts.length; i++) {
    // If it's an HTML tag, bypass
    if (parts[i].startsWith("<") && parts[i].endsWith(">")) {
      continue;
    }
    
    let text = parts[i];
    
    // Create regex pattern to match any of the keywords
    const escapedKws = keywordsList.map((k) => {
      const escaped = k.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const startBoundary = /^\w/.test(k.word) ? '\\b' : '';
      const endBoundary = /\w$/.test(k.word) ? '\\b' : '';
      return `${startBoundary}${escaped}${endBoundary}`;
    }).join('|');
    
    if (escapedKws) {
      try {
        const regex = new RegExp(`(${escapedKws})`, "gi");
        text = text.replace(regex, (match) => {
          const matchedKw = keywordsList.find(k => k.word.toLowerCase() === match.toLowerCase());
          if (matchedKw) {
            const bgClass = matchedKw.isPrimary 
              ? "bg-amber-100/90 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100" 
              : "bg-blue-100/90 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-100";
            const typeLabel = matchedKw.isPrimary ? "Primary Focus Keyword" : "Secondary Target Keyword";
            
            return `<mark class="${bgClass} px-1.5 py-0.5 rounded-md border font-semibold transition-all cursor-help" title="${typeLabel}">${match}</mark>`;
          }
          return match;
        });
      } catch (err) {
        console.error("Highlight regex failed:", err);
      }
    }
    
    parts[i] = text;
  }
  
  return parts.join("");
}

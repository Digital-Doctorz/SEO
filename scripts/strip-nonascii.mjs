import fs from "fs";
import path from "path";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function clean(s) {
  // Remove multi-char non-ASCII runs (mojibake), keep single non-ascii rare chars out
  // Keep newlines, tabs, printable ASCII
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E]{2,}/g, "");
}

// Targeted cleanups for known broken UI strings
const draftPath = path.join("src", "components", "content-hub", "BlogDraftPanel.tsx");
if (fs.existsSync(draftPath)) {
  let s = fs.readFileSync(draftPath, "utf8");
  s = s.replace(
    /<span className="text-slate-400">[\s\S]*?\{blogPost\.slugSuggestion \|\| "post-slug"\}<\/span>/,
    '<span className="text-slate-400"> / blog / {blogPost.slugSuggestion || "post-slug"}</span>'
  );
  s = s.replace(
    /<span className="text-slate-400 font-mono">Jul 13, 2026[\s\S]*?<\/span>/,
    '<span className="text-slate-400 font-mono">Updated recently - </span>'
  );
  s = clean(s);
  fs.writeFileSync(draftPath, s, "utf8");
  console.log("cleaned BlogDraftPanel");
}

let n = 0;
for (const root of ["src", "api"]) {
  for (const f of walk(root)) {
    if (f.endsWith(path.join("lib", "text.ts"))) continue;
    const before = fs.readFileSync(f, "utf8");
    const after = clean(before);
    if (after !== before) {
      fs.writeFileSync(f, after, "utf8");
      n++;
      console.log("ascii", f);
    }
  }
}
console.log("done", n);

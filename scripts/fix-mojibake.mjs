import fs from "fs";
import path from "path";

function clean(s) {
  if (!/[Ã¢â‚¬Â°Å¸]/.test(s)) return s;
  let t = s;
  t = t.replace(/Ãƒ[\u0080-\u00FF]{1,200}/g, "");
  t = t.replace(/Ã¢[\u0080-\u00FF]{1,40}/g, "");
  t = t.replace(/â€[^\s"'`<>\\]{0,8}/g, "");
  t = t.replace(/Ã°Å¸[^\s"'`<>\\]{0,24}/g, "");
  t = t.replace(/Ã[\u0080-\u00FF]{1,8}/g, "");
  t = t.replace(/Â/g, "");
  // collapse horizontal whitespace only
  t = t.replace(/[^\S\n]{2,}/g, " ");
  return t;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "dist-ssr") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

let n = 0;
for (const root of ["src", "api"]) {
  for (const f of walk(root)) {
    const before = fs.readFileSync(f, "utf8");
    const after = clean(before);
    if (after !== before) {
      fs.writeFileSync(f, after, "utf8");
      n++;
      console.log("fixed", f);
    }
  }
}
console.log("updated", n, "files");

// Validates every data file in assets/js/data/ against the shapes the pages expect.
// Run: node tools/validate-data.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "assets/js/data");
const ctx = { window: {} };
vm.createContext(ctx);

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".js")).sort();
for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    console.error(`✗ ${f}: ${e.message}`);
    process.exitCode = 1;
  }
}

const errs = [];
const err = (id, msg) => errs.push(`${id}: ${msg}`);
const isStr = (s) => typeof s === "string" && s.trim().length > 0;

// ---------- Questions ----------
const Q = ctx.window.QBANK || [];
const ids = new Set();
const pos = [0, 0, 0, 0, 0];
const byScen = {}, byDom = {};
for (const q of Q) {
  const id = q.id || "(no id)";
  if (ids.has(id)) err(id, "duplicate id");
  ids.add(id);
  if (![1, 2, 3, 4, 5, 6].includes(q.scenario)) err(id, "scenario must be 1-6");
  if (![1, 2, 3, 4, 5].includes(q.domain)) err(id, "domain must be 1-5");
  if (!/^[1-5]\.[1-7]$/.test(q.task || "")) err(id, "task must look like '1.4'");
  if (!["single", "multi"].includes(q.type)) err(id, "type must be single|multi");
  if (!isStr(q.stem)) err(id, "missing stem");
  if (!Array.isArray(q.options)) { err(id, "options missing"); continue; }
  const nOpt = q.type === "single" ? 4 : 5;
  if (q.options.length !== nOpt) err(id, `${q.type} needs ${nOpt} options`);
  if (!Array.isArray(q.answer) || q.answer.length !== q.pick) err(id, "answer length must equal pick");
  if (q.type === "single" && q.pick !== 1) err(id, "single must have pick 1");
  if (q.type === "multi" && ![2, 3].includes(q.pick)) err(id, "multi pick must be 2 or 3");
  for (const a of q.answer || []) if (!(a >= 0 && a < q.options.length)) err(id, "answer index out of range");
  if (!Array.isArray(q.rationale) || q.rationale.length !== q.options.length) err(id, "rationale must match options");
  if (!isStr(q.takeaway)) err(id, "missing takeaway");
  if (q.type === "single") pos[q.answer[0]]++;
  byScen[q.scenario] = (byScen[q.scenario] || 0) + 1;
  byDom[q.domain] = (byDom[q.domain] || 0) + 1;
}

// ---------- Cases ----------
const C = ctx.window.CASES || [];
for (const c of C) {
  const id = c.id || "(no id)";
  if (ids.has(id)) err(id, "duplicate id"); ids.add(id);
  if (![1, 2, 3, 4, 5, 6].includes(c.scenario)) err(id, "scenario must be 1-6");
  if (!isStr(c.title) || !isStr(c.brief) || !isStr(c.lesson)) err(id, "title/brief/lesson required");
  if (!Array.isArray(c.steps) || c.steps.length < 2) err(id, "needs 2+ steps");
  (c.steps || []).forEach((s, i) => {
    if (!isStr(s.q)) err(`${id}#${i}`, "step q missing");
    if (!Array.isArray(s.options) || s.options.length !== 4) err(`${id}#${i}`, "step needs 4 options");
    if (!(s.answer >= 0 && s.answer < 4)) err(`${id}#${i}`, "bad answer");
    if (!Array.isArray(s.feedback) || s.feedback.length !== 4) err(`${id}#${i}`, "needs 4 feedback");
  });
}

// ---------- Flashcards ----------
const F = ctx.window.FLASHCARDS || [];
for (const f of F) {
  const id = f.id || "(no id)";
  if (ids.has(id)) err(id, "duplicate id"); ids.add(id);
  if (![1, 2, 3, 4, 5].includes(f.domain)) err(id, "domain must be 1-5");
  if (!isStr(f.front) || !isStr(f.back)) err(id, "front/back required");
}

console.log(`Questions: ${Q.length}  by scenario ${JSON.stringify(byScen)}  by domain ${JSON.stringify(byDom)}`);
console.log(`Single-answer positions A-D: ${pos.slice(0, 4).join(" / ")}`);
console.log(`Cases: ${C.length}   Flashcards: ${F.length}`);
if (errs.length) {
  console.error(`\n${errs.length} problem(s):\n` + errs.map((e) => "  - " + e).join("\n"));
  process.exitCode = 1;
} else console.log("All data files valid.");

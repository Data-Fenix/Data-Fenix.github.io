// Evaluate the offline assistant.
//
//   node tools/eval_assistant.mjs            dev set (assistant_eval*.jsonl), used for tuning
//   node tools/eval_assistant.mjs --holdout  held-out set (assistant_holdout*.jsonl), never tuned against
//   node tools/eval_assistant.mjs --blind    final blind set, run once after a round of changes
//   node tools/eval_assistant.mjs --verbose  print every answer
//
// Every standalone question is scored twice:
//   fresh  - asked as the first message of a chat
//   in-chat - asked after an unrelated earlier question, the way visitors really use the widget
//
// Item fields: q, facts (all must appear), lead (must appear in the first sentence),
// expect: unknown | refuse | decline (unknown or refuse) | greeting, history: [previous user questions].
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["js/projects.js", "js/knowledge.js", "js/assistant-offline.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const projects = ctx.window.PORTFOLIO_PROJECTS;
const engine = ctx.window.OfflineAssistant;

// The fallback the site used before: keyword overlap against project cards only.
function baseline(question) {
  const terms = question.toLowerCase().match(/[a-z0-9]+/g) || [];
  const scored = projects
    .map((p) => {
      const hay = [p.title, p.summary, ...(p.tags || [])].join(" ").toLowerCase();
      return { p, score: terms.reduce((s, t) => s + (t.length > 2 && hay.includes(t) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!scored.length) return { text: "I couldn't find that in the project catalogue." };
  return { text: scored.map(({ p }) => `• ${p.title}: ${p.summary}`).join("\n\n") };
}

const isUnknown = (t) => t.includes("don't have") || t.includes("couldn't find");
const isRefuse = (t) => t.includes("only help") || t.includes("outside what");
function judge(item, text) {
  const t = text.toLowerCase();
  if (item.expect === "unknown") return isUnknown(t);
  if (item.expect === "refuse") return isRefuse(t);
  if (item.expect === "decline") return isUnknown(t) || isRefuse(t);
  if (item.expect === "greeting") return t.startsWith("hi");
  const first = t.split(/(?<=[.!?])\s|\[\d+\]/)[0];
  const facts = item.facts || [];
  const lead = item.lead || [];
  return facts.every((f) => t.includes(f.toLowerCase())) && lead.every((f) => first.includes(f.toLowerCase()));
}

const setArg = process.argv.indexOf("--set");
const prefix = setArg > 0 ? process.argv[setArg + 1]
  : process.argv.includes("--blind") ? "assistant_blind" : process.argv.includes("--holdout") ? "assistant_holdout" : "assistant_eval";
const items = fs
  .readdirSync(path.join(root, "tools"))
  .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
  .sort()
  .flatMap((f) => fs.readFileSync(path.join(root, "tools", f), "utf8").split("\n"))
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));
const verbose = process.argv.includes("--verbose");

// Distractor histories: unrelated topics a visitor might have asked about first.
const DISTRACTORS = [
  "What did Lahiru do at Dialog Axiata?",
  "Tell me about the smart car parking project",
  "What is the deep reinforcement learning research about?",
  "Which projects use AWS SageMaker?",
];

let base = 0, fresh = 0, inChat = 0, inChatN = 0;
const fails = [];
items.forEach((item, k) => {
  const own = (item.history || []).map((h) => ({ role: "user", content: h }));
  const okB = judge(item, baseline(item.q).text);
  const a = engine.answer(item.q, own);
  const okF = judge(item, a.text);
  base += okB;
  fresh += okF;
  if (!okF) fails.push({ mode: "fresh", item, got: a.text });
  if (verbose) console.log(`\n[${okF ? "PASS" : "FAIL"}] ${item.id} ${item.q}\n${a.text}`);
  if (!item.history) {
    const d = DISTRACTORS[k % DISTRACTORS.length];
    const hist = [{ role: "user", content: d }, { role: "assistant", content: engine.answer(d, []).text }];
    const b = engine.answer(item.q, hist);
    const okC = judge(item, b.text);
    inChat += okC;
    inChatN += 1;
    if (!okC && okF) fails.push({ mode: `in-chat after "${d}"`, item, got: b.text });
  }
});
const pct = (a, b) => `${a}/${b} (${Math.round((100 * a) / b)}%)`;
const label = { assistant_holdout: "HELD-OUT", assistant_blind: "BLIND" }[prefix] || "DEV";
console.log(`\n${label} set: ${items.length} questions`);
console.log(`Old keyword fallback       : ${pct(base, items.length)}`);
console.log(`Offline assistant, fresh   : ${pct(fresh, items.length)}`);
console.log(`Offline assistant, in-chat : ${pct(inChat, inChatN)}`);
if (fails.length) {
  console.log(`\nFailures (${fails.length}):`);
  fails.forEach((f) => {
    const want = f.item.facts || f.item.lead || f.item.expect;
    console.log(`  ${f.item.id} [${f.mode}] "${f.item.q}" wanted ${JSON.stringify(want)}\n     got: ${f.got.replace(/\n/g, " ").slice(0, 170)}`);
  });
}
process.exitCode = fresh / items.length >= 0.9 && inChat / inChatN >= 0.9 ? 0 : 1;

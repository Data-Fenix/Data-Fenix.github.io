/* Offline portfolio assistant.

   Runs entirely in the browser when the Claude backend is unreachable (for
   example on GitHub Pages). It answers from the same knowledge base the
   backend uses (js/knowledge.js, generated from portfolio-rag-chatbot) and the
   project catalogue (js/projects.js).

   Pipeline
   1. Guardrails   empty, overlong, prompt-injection, off-topic and personal questions.
   2. Intents      greeting, thanks, contact, and "which projects use X" lists.
   3. Query        tokens -> typo correction -> synonym expansion.
   4. Follow-ups   a question inherits the previous topic only when it refers back
                   ("it", "and at Memodo?"), uses only generic words ("the results?"),
                   or finds nothing on its own. Standalone questions stay standalone.
   5. Retrieval    BM25 over knowledge sections with a coordination factor that
                   rewards sections matching more of the question.
   6. Answering    overview mode for "education" / "achievements" style questions;
                   otherwise the most relevant sentences, preferring answer-bearing
                   words over the words that merely name the topic; cited.
   7. Abstention   "I don't have that detail" when the question is not covered.

   Exposes window.OfflineAssistant.answer(question, history) -> {text, sources}.
*/
(function () {
  "use strict";

  const KB = window.PORTFOLIO_KB || [];
  const PROJECTS = window.PORTFOLIO_PROJECTS || [];
  const CATEGORIES = Object.fromEntries((window.PORTFOLIO_CATEGORIES || []).map((c) => [c.id, c.label]));

  const STOP = new Set(
    ("a an the and or of in on for to with at by from as is are was were be been being it its this that these those " +
      "what which who whom whose how why when where did does do done has have had can could would should will " +
      "i me my you your we our they them he him his she her lahiru lahirus dissanayake anuradha " +
      "tell about any some all more most also just please give show know like into than then there here " +
      "much many very really get got make made use used using thing things kind across " +
      "explain describe short brief quick")
      .split(" ")
  );

  const IRREGULAR_EARLY = { built: "build", ran: "run", led: "lead", grew: "grow", wrote: "write", taught: "teach" };
  function stemWord(w) {
    if (IRREGULAR_EARLY[w]) return IRREGULAR_EARLY[w];
    if (w.length > 6 && w.endsWith("ly")) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && w.endsWith("es") && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
    if (w.length > 5 && w.endsWith("ing")) {
      const r = w.slice(0, -3);
      return /([bdgmnprt])\1$/.test(r) ? r.slice(0, -1) : r;
    }
    if (w.length > 5 && /[^aeiou]led$|[^aeiou]sed$|ized$|ated$/.test(w)) return w.slice(0, -1);
    return w;
  }

  // Visitor vocabulary -> words used in the knowledge base.
  const SYNONYMS = {
    job: ["role", "engineer", "position"], title: ["role", "position", "engineer"], role: ["engineer", "position"],
    position: ["role", "engineer"], titled: ["title"], current: ["present", "since", "now"], currently: ["current", "present", "since"],
    now: ["current", "present"], today: ["current", "present"], employer: ["company", "memodo"],
    start: ["started", "since"], started: ["since"], join: ["started", "since"], joined: ["started", "since"],
    company: ["employer", "memodo", "dialog"], companies: ["employer", "career", "history"], before: ["previous", "history", "career"],
    previous: ["history", "career", "before"], history: ["career", "timeline"], career: ["history", "experience"],
    responsibility: ["own", "role", "platform"], duty: ["own", "role"], duties: ["own", "role"], task: ["own", "role"],
    total: ["year", "experience"], year: ["experience"], long: ["year", "experience"], overall: ["total", "year"],
    experience: ["experience", "year"], summary: ["overview", "who"], overview: ["summary"], introduction: ["who", "summary"],
    who: ["summary", "introduction"], background: ["summary", "overview", "education"],
    study: ["university", "education", "degree"], studied: ["university", "education"], studying: ["university", "education"],
    university: ["education"], universities: ["university", "education"], school: ["university", "education"],
    degree: ["university", "education", "bachelor", "msc"], degrees: ["university", "education"], bachelor: ["bsc", "science"],
    master: ["msc", "thesis"], masters: ["msc", "thesis"], qualification: ["education", "degree"],
    certification: ["certified", "certificate"], certificate: ["certified", "certification"], certified: ["certification"],
    course: ["certification", "certificate", "course"], courses: ["certification", "course"], online: ["course", "coursera"],
    award: ["achievement", "summit"], awards: ["achievement", "summit"], achievement: ["achievement", "highlight"],
    recognition: ["achievement"], competition: ["summit", "top-10", "achievement"], ranking: ["top-10", "selected"], rank: ["top-10", "selected"],
    brand: ["brand", "handle"], fenix: ["brand", "handle", "github"], website: ["site", "amazon", "ebay", "idealo"], websites: ["amazon", "ebay", "idealo"],
    thesis: ["master", "research", "travelling"], paper: ["research", "co", "authored"], supervisor: ["supervised"],
    rl: ["reinforcement"], tsp: ["travelling", "salesman"], drl: ["reinforcement"],
    llm: ["genai", "claude"], llms: ["genai", "claude"], ai: ["genai", "machine", "learning"], genai: ["claude", "rag"],
    chatbot: ["assistant", "rag", "chatbot"], bot: ["chatbot", "assistant"], assistant: ["chatbot", "rag"],
    hallucination: ["grounded", "citations", "retrieval"], hallucinations: ["grounded", "citations", "retrieval"],
    reliable: ["schema", "eval", "gate", "validated"], reliability: ["schema", "eval", "gate"], evaluated: ["evaluation", "eval"],
    accuracy: ["r2", "mae", "accuracy", "f1"], accurate: ["r2", "mae", "accuracy"], error: ["mae", "rmse"],
    result: ["better", "faster", "achieving", "improved"], results: ["better", "faster", "improved"], outcome: ["better", "improved"],
    fast: ["faster", "inference"], speed: ["faster", "inference"], faster: ["inference"],
    cloud: ["aws", "azure"], cost: ["spend", "saving", "cut", "cost"], costs: ["spend", "cut"], saving: ["spend", "cut", "saving"],
    save: ["saving", "million", "lower"], saved: ["saving", "million"], money: ["million", "spend"], cheaper: ["lower", "cost"],
    team: ["engineers", "grow"], size: ["engineers"], big: ["engineers", "grow"], grew: ["growing", "engineers"],
    language: ["python", "programming"], languages: ["python", "programming"], programming: ["python"],
    skill: ["skill"], tool: ["skill"], tools: ["skill"], tech: ["skill"], stack: ["skill"], framework: ["pytorch", "tensorflow"],
    frameworks: ["pytorch", "tensorflow"], visualisation: ["visualisation", "tableau", "power"], visualization: ["visualisation", "tableau"],
    based: ["hildesheim", "germany", "based"], live: ["based", "hildesheim"], location: ["based", "hildesheim"], located: ["based"],
    contact: ["linkedin", "github", "contact"], reach: ["contact", "linkedin"], email: ["contact"], hire: ["contact", "open"],
    opportunity: ["open", "conversations"], opportunities: ["open", "conversations"],
    vision: ["image", "cnn", "computer"], image: ["cnn", "computer"], images: ["cnn"], plant: ["leaf", "potato"],
    forecasting: ["forecast", "forecasting"], forecast: ["forecasting"], prediction: ["predict", "predicts"], predict: ["prediction"],
    scraping: ["scraper", "scraping"], scrape: ["scraper", "scraping"], price: ["pricing", "price"], pricing: ["price", "competitor"],
    shop: ["amazon", "ebay", "idealo"], shops: ["amazon", "ebay", "idealo"], store: ["storage", "storing"], stores: ["storage", "storing"],
    model: ["trained", "regression", "classifier"], models: ["trained", "regression", "classifier"],
    dataset: ["dataset", "data"], data: ["data"], contain: ["covering", "notebooks", "include"], contains: ["covering", "include"],
    manual: ["manual", "days", "hours"], automated: ["automated", "reduced"], automation: ["automated"],
    present: ["presented", "summit"], presented: ["summit"], talk: ["presented", "summit"],
    intern: ["intern", "analyst"], internship: ["intern", "analyst"], hbb: ["broadband", "postpaid", "exhaustion"],
    broadband: ["hbb", "exhaustion"], parking: ["parking", "spots"], churn: ["churn", "telco"],
    match: ["matching", "matcher", "strategies", "catalogue"], matched: ["matching", "matcher"], method: ["strategies", "matcher"],
    compare: ["trained", "benchmarked", "versus"], compared: ["trained", "benchmarked", "versus"], comparison: ["benchmarked", "trained"],
    classical: ["traditional"], traditional: ["classical"], solver: ["solvers", "traditional"],
    practice: ["practices", "best"], practices: ["best"], principle: ["practices", "best"], principles: ["practices", "best"],
    build: ["designed", "developed", "created", "build"], design: ["designed", "build"], develop: ["developed", "build"],
    create: ["created", "build"], first: ["started", "intern", "began"], earliest: ["started", "intern"], began: ["started"], good: ["skill", "experience"], strong: ["skill"], strongest: ["skill", "mlop"], expert: ["skill"], proficient: ["skill"],
    freelancer: ["freelancing", "freelance"], freelance: ["freelancing"], reduce: ["cut", "cutting", "reduction", "reduced"],
    work: ["role", "employer", "engineer"], worked: ["role", "employer"], working: ["role", "employer"], highest: ["peak"], busiest: ["peak"], peak: ["peak"],
    often: ["weekly", "daily", "quarterly"], frequency: ["weekly", "daily"], feature: ["features", "variables"],
  };

  // Tokens are stemmed before lookup ("ranking" -> "rank"), so index synonyms by stem too.
  Object.keys(SYNONYMS).forEach((k) => {
    const s = k.length > 3 ? stemWord(k) : k;
    if (s !== k) SYNONYMS[s] = [...new Set([...(SYNONYMS[s] || []), ...SYNONYMS[k]])];
  });

  const INJECTION = /ignore (all |the |any )?(previous|prior|above) (instructions|prompts?|rules)|disregard (all |the |your )?(previous|prior|system) (instructions|prompt)|reveal (your|the) (system|hidden|secret) prompt|print (your|the) (system )?prompt|\bjailbreak\b|developer mode/i;
  const OFF_TOPIC = /\b(write (me )?(a|an) (poem|story|essay|song)|tell me a (story|joke)|medical advice|legal advice|stock tips|homework|translate this|recipe|what('s| is) the weather|weather (today|tomorrow|like)|what time is it|recommend me|buy me)\b|^\s*what('s| is)\s+[\d\s+*\/-]+\??\s*$/i;
  const PERSONAL = /\b(speak|spoken|how old|his age|salary|married|wife|girlfriend|religion|birthday|date of birth|born|height|how tall|weight|nationality|visa|address|phone number|mobile number|grow up|grew up|hometown|childhood|family|parents|hobby|hobbies)\b/i;
  const GREETING = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|greetings|yo)\b[\s!.?]*$/i;
  const THANKS = /^\s*(thanks|thank you|thx|cheers|great|cool|nice|ok|okay)\b[\s!.]*$/i;
  const CONTACT = /\b(contact|reach (him|out|lahiru)|get in touch|email|e-mail|linkedin|hire|connect with|github profile|his github)\b/i;
  const PROJECT_LIST = /\b(which|list|show|any|all)\b[^?]*\bprojects?\b(?!'s)|\b(what|wat)\b[^?]*\bprojects\b|\bprojects\b[^?]*\b(use|uses|using|with|built|involv\w*|related)\b/i;
  const ANAPHORA = /\b(it|its|it's|that|this|these|those|they|them|their|there)\b|^\s*(and|what about|how about|also|so|then)\b/i;
  // Words that carry no topic of their own; a question made only of these refers to the previous topic.
  const GENERIC = new Set(
    ("result outcome metric accuracy error performance score dataset data feature model impact benefit cost saving method " +
      "approach technique tool stack technology best detail example number size time duration long fast speed step " +
      "architecture design challenge problem limitation next plan train trained evaluate evaluation test")
      .split(" ")
  );

  const UNKNOWN =
    "I don't have that detail in Lahiru's portfolio. I can answer questions about his experience, research, projects, " +
    "education, certifications and skills. For anything else, you can reach him on LinkedIn.";
  const LINKEDIN = { title: "LinkedIn", url: "https://www.linkedin.com/in/anuradha-dissanayake-a33738181/" };

  /* ---------------- text utilities ---------------- */
  const IRREGULAR = { built: "build", ran: "run", led: "lead", grew: "grow", wrote: "write", taught: "teach" };
  function stem(w) {
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w.length > 6 && w.endsWith("ly")) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && w.endsWith("es") && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
    if (w.length > 5 && w.endsWith("ing")) {
      const r = w.slice(0, -3);
      return /([bdgmnprt])\1$/.test(r) ? r.slice(0, -1) : r;
    }
    if (w.length > 5 && /[^aeiou]led$|[^aeiou]sed$|ized$|ated$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function rawTokens(text) {
    return (text.toLowerCase().replace(/['’]s\b/g, "").match(/[a-z0-9]+(?:[.,-][0-9a-z]+)*%?/g) || [])
      .map((t) => t.replace(/%$/, ""))
      .flatMap((t) => (/^[a-z]+-[a-z]+$/.test(t) ? [t, ...t.split("-")] : [t]));
  }
  function tokens(text) {
    return rawTokens(text).filter((t) => t && !STOP.has(t)).map(stem);
  }

  /* ---------------- index ---------------- */
  const docs = KB.map((c) => tokens(`${c.title} ${c.section} ${c.section} ${c.text}`));
  const sentTokens = KB.map((c) => c.sentences.map((s) => new Set(tokens(s))));
  const headTokens = KB.map((c) => new Set(tokens(c.section)));
  const avgdl = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  const tf = docs.map((d) => d.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map()));
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const N = docs.length;
  const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
  const avgIdf = [...df.keys()].reduce((a, t) => a + idf(t), 0) / Math.max(1, df.size);

  // Vocabulary for typo correction: knowledge words, synonym keys and project words.
  const VOCAB = new Map(df);
  Object.keys(SYNONYMS).forEach((k) => VOCAB.set(stem(k), Math.max(VOCAB.get(stem(k)) || 0, 1)));
  PROJECTS.forEach((p) => tokens(`${p.title} ${p.summary} ${(p.tags || []).join(" ")}`).forEach((t) => VOCAB.set(t, Math.max(VOCAB.get(t) || 0, 1))));

  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        rowMin = Math.min(rowMin, v);
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length];
  }
  const corrections = new Map();
  function correct(t) {
    if (VOCAB.has(t) || t.length < 4 || /\d/.test(t)) return t;
    if (corrections.has(t)) return corrections.get(t);
    const max = t.length >= 8 ? 2 : 1;
    let best = t, bestD = max + 1, bestF = -1;
    VOCAB.forEach((f, v) => {
      if (Math.abs(v.length - t.length) > max || v[0] !== t[0]) return;
      const d = editDistance(t, v, max);
      if (d < bestD || (d === bestD && f > bestF)) { best = v; bestD = d; bestF = f; }
    });
    const out = bestD <= max ? best : t;
    corrections.set(t, out);
    return out;
  }

  /* ---------------- query construction ---------------- */
  function questionTokens(question) {
    return rawTokens(question)
      .filter((t) => t && !STOP.has(t))
      .map((raw) => {
        const s = stem(raw);
        return raw.length >= 5 ? correct(s) : s;
      });
  }

  function buildQuery(question, prevQuestion) {
    const q = new Map();
    const add = (t, w) => q.set(t, Math.max(q.get(t) || 0, w));
    const base = questionTokens(question);
    base.forEach((t) => add(t, 1));
    const aboutWork = base.some((t) => t === "thesis" || t === "paper" || t === "research");
    base.forEach((t) => {
      if (aboutWork && t === "title") return;
      (SYNONYMS[t] || []).forEach((s) => add(stem(s), 0.45));
    });
    if (prevQuestion) questionTokens(prevQuestion).forEach((t) => add(t, 0.6));
    if (/^\s*how (is|was|are|does|do|did)\b.*\b(built|build|work|works|designed|implemented|structured|made)\b/i.test(question)) {
      ["cover", "architecture", "step", "train", "uses", "pipeline", "ingestion"].forEach((s) => add(stem(s), 0.8));
    }
    return { q, base, followUp: Boolean(prevQuestion) };
  }

  function bm25(query, base, i) {
    const k1 = 1.4, b = 0.7, m = tf[i], dl = docs[i].length;
    let s = 0;
    query.forEach((w, t) => {
      const f = m.get(t);
      if (!f) return;
      s += w * idf(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl));
    });
    // Coordination: prefer sections that match more of the visitor's own words.
    if (base.length > 1) {
      const matched = base.filter((t) => m.has(t) || (SYNONYMS[t] || []).some((x) => m.has(stem(x)))).length;
      s *= 0.6 + 0.4 * (matched / base.length);
    }
    return s;
  }

  function retrieve(question, prevQuestion) {
    const { q, base, followUp } = buildQuery(question, prevQuestion);
    if (!base.length && !followUp) return null;
    const ranked = KB.map((c, i) => ({ c, i, s: bm25(q, base, i) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (!ranked.length) return null;
    const best = ranked[0].s;
    const topDocs = ranked.slice(0, 3);
    const inTop = (t) => topDocs.some((r) => tf[r.i].has(t));
    const hitWeight = (t) => (inTop(t) ? 1 : (SYNONYMS[t] || []).some((s) => inTop(stem(s))) ? 0.8 : 0);
    const hits = base.filter((t) => hitWeight(t) > 0);
    if (!followUp) {
      if (!hits.length || best < 1.6) return null;
      // Coverage: how much of the question the best sections explain. Unknown words count at average weight.
      const w = (t) => (df.has(t) ? idf(t) : avgIdf);
      const total = base.reduce((a, t) => a + w(t), 0);
      const covered = hits.reduce((a, t) => a + hitWeight(t) * w(t), 0);
      if (total > 0 && covered / total < 0.4) return null;
    }
    return { q, base, ranked: ranked.filter((r) => r.s >= best * 0.45).slice(0, 4) };
  }

  /* ---------------- answer composition ---------------- */
  function cite(sourceList, chunk) {
    const key = chunk.url || chunk.title;
    let n = sourceList.findIndex((s) => (s.url || s.title) === key);
    if (n === -1) {
      const short = chunk.section.replace(/\s*\(.*\)\s*$/, "");
      sourceList.push({ title: short.length < 60 ? short : chunk.title, url: chunk.url });
      n = sourceList.length - 1;
    }
    return n + 1;
  }

  function render(picked) {
    const sources = [];
    const text = picked.map((p) => `${p.sent.replace(/\s+$/, "")} [${cite(sources, p.chunk)}]`).join(" ");
    return { text, sources };
  }

  // "education", "achievements", "skills": the question is essentially a section heading.
  function overview({ base, ranked }) {
    const top = ranked[0];
    const head = headTokens[top.i];
    const named = base.filter((t) => !GENERIC.has(t));
    if (!named.length || named.length > 3) return null;
    const inHead = (t) => head.has(t) || (SYNONYMS[t] || []).some((s) => head.has(stem(s)));
    if (!named.every(inHead)) return null;
    const out = [];
    let chars = 0;
    for (let j = 0; j < top.c.sentences.length && out.length < 6 && chars < 700; j++) {
      out.push({ sent: top.c.sentences[j], chunk: top.c });
      chars += top.c.sentences[j].length;
    }
    return out.length ? render(out) : null;
  }

  // Share of the shorter sentence's words that also appear in the other sentence.
  function overlap(a, b) {
    const A = sentTokens[a.i] ? sentTokens[a.i][a.j] : new Set(tokens(a.sent));
    const B = sentTokens[b.i] ? sentTokens[b.i][b.j] : new Set(tokens(b.sent));
    let n = 0;
    A.forEach((t) => { if (B.has(t)) n += 1; });
    return n / Math.max(1, Math.min(A.size, B.size));
  }

  function extract({ q, base, ranked }) {
    const topScore = ranked[0].s;
    const candidates = [];
    ranked.forEach((r, rank) => {
      const head = headTokens[r.i];
      r.c.sentences.forEach((sent, j) => {
        const st = sentTokens[r.i][j];
        let s = 0, own = 0;
        q.forEach((w, t) => {
          if (!st.has(t)) return;
          // Words that name the section's topic identify it; the other words carry the answer.
          s += w * idf(t) * (head.has(t) ? 0.45 : 1);
          if (base.includes(t)) own += 1;
        });
        const hb = j < 2 ? 0.6 : 0.4;
        q.forEach((w, t) => { if (head.has(t) && !st.has(t)) s += hb * w * idf(t); });
        if (s === 0) return;
        const lenPenalty = Math.sqrt(1 + st.size / 22);
        const score = (s / lenPenalty) * (0.55 + 0.45 * (r.s / topScore)) + (j === 0 ? 0.25 : 0) + own * 0.2;
        candidates.push({ score, sent, chunk: r.c, i: r.i, rank, j });
      });
    });
    if (!candidates.length) {
      // The section matched (often through its heading or a link) but no sentence repeats the words.
      const top = ranked[0];
      return render(top.c.sentences.slice(0, 2).map((sent) => ({ sent, chunk: top.c })));
    }
    candidates.sort((a, b) => b.score - a.score);
    const bestScore = candidates[0].score;
    const picked = [];
    let chars = 0;
    for (const c of candidates) {
      if (picked.length >= 3 || chars > 520) break;
      if (c.score < bestScore * 0.5) break;
      if (picked.some((p) => p.sent === c.sent || overlap(p, c) > 0.55)) continue;
      picked.push(c);
      chars += c.sent.length;
    }
    // Continue the explanation with the next sentence of the best section when it adds detail,
    // e.g. "Co-led the AI and Data Governance working group." -> "Designed an 11-criteria framework..."
    // The lead is the best sentence from the top-ranked section, so a one-line summary elsewhere
    // (e.g. the introduction) cannot crowd out the section that actually answers the question.
    const lead = picked.find((p) => p.rank === 0) || candidates.find((c) => c.rank === 0) || picked[0];
    if (!picked.includes(lead)) { if (picked.length >= 3) picked.pop(); picked.push(lead); }
    const nextSent = lead.chunk.sentences[lead.j + 1];
    if (nextSent && !picked.some((p) => p.sent === nextSent)) {
      const scored = candidates.find((c) => c.chunk === lead.chunk && c.j === lead.j + 1);
      if ((scored && scored.score >= bestScore * 0.3) || lead.sent.length < 90) {
        const cont = scored || { sent: nextSent, chunk: lead.chunk, rank: lead.rank, j: lead.j + 1, score: 0 };
        if (picked.length < 3) picked.push(cont);
        else {
          // Only displace the weakest other sentence, and only if the continuation is worth more.
          const others = picked.filter((p) => p !== lead).sort((a, b) => (a.score || 0) - (b.score || 0));
          const weakest = others[0];
          if (weakest && ((weakest.score || 0) < (cont.score || 0) || lead.sent.length < 90)) {
            picked.splice(picked.indexOf(weakest), 1, cont);
          }
        }
      }
    }
    // A short picked sentence is usually a heading-like statement; its next sentence holds the detail.
    for (const p of picked.slice()) {
      if (picked.length >= 4) break;
      const next = p.chunk.sentences[p.j + 1];
      if (p.sent.length < 90 && next && !picked.some((x) => x.sent === next)) {
        picked.push({ sent: next, chunk: p.chunk, rank: p.rank, j: p.j + 1 });
      }
    }
    picked.sort((a, b) => a.rank - b.rank || a.j - b.j);
    return render(picked);
  }

  /* ---------------- intents ---------------- */
  function projectList(base) {
    const generic = new Set(["project", "portfolio", "built", "build", "github", "repo", "repository", "wat"]);
    const terms = base.filter((t) => !generic.has(t));
    const expanded = new Set(terms.flatMap((t) => [t, ...(SYNONYMS[t] || []).map(stem)]));
    const hay = (p) => new Set(tokens([p.title, p.summary, ...(p.tags || []), CATEGORIES[p.category] || ""].join(" ")));
    let matches = PROJECTS.map((p) => {
      const h = hay(p);
      let s = 0;
      terms.forEach((t) => { if (h.has(t)) s += 1; });
      expanded.forEach((t) => { if (!terms.includes(t) && h.has(t)) s += 0.3; });
      return { p, s };
    }).filter((x) => x.s >= 0.9);
    let intro;
    if (!terms.length) {
      matches = PROJECTS.filter((p) => p.featured).map((p) => ({ p, s: 1 }));
      intro = "Here are Lahiru's highlighted projects:";
    } else if (!matches.length) {
      return null;
    } else {
      intro = `${matches.length === 1 ? "One project matches" : `${matches.length} projects match`}:`;
    }
    matches.sort((a, b) => b.s - a.s || (b.p.featured === true) - (a.p.featured === true) || b.p.year - a.p.year);
    const top = matches.slice(0, 6);
    const sources = top.map(({ p }) => ({ title: p.title, url: `https://github.com/${p.repo}` }));
    const lines = top.map(({ p }, i) => `• ${p.title} (${CATEGORIES[p.category] || p.category}): ${p.summary.split(/(?<=\.)\s/)[0]} [${i + 1}]`);
    const more = matches.length > top.length ? `\n\n…and ${matches.length - top.length} more in the Projects section.` : "";
    return { text: `${intro}\n\n${lines.join("\n")}${more}`, sources };
  }

  function contactAnswer() {
    return {
      text:
        "You can reach Lahiru on LinkedIn [1] or by email at anuradha95dissanayake@gmail.com. His code is on GitHub at " +
        "github.com/Data-Fenix [2]. He is open to data platform, MLOps and GenAI engineering conversations.",
      sources: [LINKEDIN, { title: "GitHub", url: "https://github.com/Data-Fenix" }],
    };
  }

  // Decide whether the question continues the previous topic.
  function isFollowUp(question, base, prevQuestion) {
    if (!prevQuestion) return false;
    if (ANAPHORA.test(question)) return true;
    if (!base.length) return true;
    return base.every((t) => GENERIC.has(t) || (SYNONYMS[t] || []).some((s) => GENERIC.has(stem(s))));
  }

  function answer(question, history) {
    const q = String(question || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    if (!q) return { text: "Please type a question about Lahiru's work.", sources: [] };
    if (q.length > 500) return { text: "Please keep questions under 500 characters.", sources: [] };
    if (INJECTION.test(q)) {
      return { text: "I can only help with questions about Lahiru's projects, experience and skills, and I don't change my instructions based on chat messages.", sources: [] };
    }
    if (OFF_TOPIC.test(q)) {
      return { text: "That's outside what I can help with. I answer questions about Lahiru's portfolio: his data platform and MLOps work, research, projects and GenAI applications.", sources: [] };
    }
    if (GREETING.test(q)) {
      return { text: "Hi! I'm Lahiru's portfolio assistant. Ask me about his current role at Memodo, his MLOps work at Dialog Axiata, his research, or any of his projects.", sources: [] };
    }
    if (THANKS.test(q)) return { text: "You're welcome! Anything else you'd like to know about Lahiru's work?", sources: [] };
    if (PERSONAL.test(q)) return { text: UNKNOWN, sources: [LINKEDIN] };
    if (CONTACT.test(q)) return contactAnswer();

    const base = questionTokens(q);
    if (!base.length && /\b(lahiru|him|he|dissanayake|yourself|you)\b/i.test(q)) {
      const intro = KB.find((c) => /^who is lahiru/i.test(c.section));
      if (intro) return render(intro.sentences.slice(0, 3).map((sent) => ({ sent, chunk: intro })));
    }
    if (PROJECT_LIST.test(q)) {
      const list = projectList(base);
      if (list) return list;
    }

    const prevQuestion = (history || []).filter((h) => h.role === "user").map((h) => h.content).pop();
    let hit = null;
    if (isFollowUp(q, base, prevQuestion)) hit = retrieve(q, prevQuestion);
    if (!hit) hit = retrieve(q, null);
    // Elliptical follow-up ("and the dataset?"): only when every word is known portfolio vocabulary.
    if (!hit && prevQuestion && base.length <= 4 && base.every((t) => VOCAB.has(t))) hit = retrieve(q, prevQuestion);
    if (!hit) return { text: UNKNOWN, sources: [LINKEDIN] };
    return overview(hit) || extract(hit);
  }

  window.OfflineAssistant = { answer, _tokens: tokens, _correct: correct };
})();

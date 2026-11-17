# Lahiru Dissanayake · Portfolio

Interactive, dependency-free portfolio site for Lahiru Anuradha Dissanayake.
Plain HTML, CSS and JavaScript, so it deploys to GitHub Pages with no build step.

## Features

- Animated canvas background: a drifting data graph with rising embers that reacts to the pointer (`js/background.js`)
- Page loader, scroll progress bar, staggered scroll reveals, animated timelines, 3D card tilt, back-to-top button
- About section with portrait, résumé download and view buttons
- Research section with three illustrated case studies
- Project grid with cover images and GIFs, filters, search and an "Explore all projects" button; click any image for a full-size preview
- Education timeline, certifications with verification links, achievements
- Floating AI assistant (bottom-right on every screen; add `?chat` to the URL to open it directly) that streams answers from the
  [portfolio-rag-chatbot](../portfolio-rag-chatbot) backend, and otherwise answers in the browser from the same knowledge base (see below)
- Dark and light theme, keyboard accessible, honours `prefers-reduced-motion`

## Run locally

```bash
cd portfolio
python -m http.server 8080
# open http://localhost:8080
```

## Update content

| What | Where |
|---|---|
| Projects (title, summary, tags, image, featured flag) | `js/projects.js` |
| How many projects show before "Explore all" | `INITIAL_PROJECTS` in `js/main.js` |
| Experience, research, education, certifications | sections in `index.html` |
| Résumé | replace `assets/Lahiru_Dissanayake_Resume.pdf` (keep the file name) |
| Portrait | replace `assets/profile.jpg` (square works best) |
| Project images | drop files in `assets/projects/` and reference them in `js/projects.js` |
| Certificate images, university and company logos | `assets/certs/`, `assets/education/`, `assets/companies/` |
| Generated SVG covers and research illustrations | edit and run `python tools/make_covers.py` |
| Colours | tokens at the top of `css/style.css` |

## Deploy to GitHub Pages

1. Push this folder as the root of a repository on the `main` branch.
2. In the repository settings open **Pages**, choose *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Set `DEFAULT_BACKEND` in `js/main.js` to the public URL of the deployed chatbot backend, and add the Pages origin
   to `ALLOWED_ORIGINS` in the backend's `.env`.

Note: the résumé PDF is published with the site. Check that it contains only the contact details you want public.

## Offline assistant

When the Claude backend is not reachable (for example on GitHub Pages), the chat panel answers in the browser with
`js/assistant-offline.js`: guardrails, BM25 retrieval with synonyms and follow-up handling over `js/knowledge.js`,
extractive answers with numbered citations, and an honest "I don't have that detail" when nothing matches.

`js/knowledge.js` is generated from `../portfolio-rag-chatbot/data/knowledge/*.md`, the same source the backend uses.
After editing those files:

```bash
python tools/build_knowledge.py
node tools/eval_assistant.mjs                            # dev set, 108 questions, used for tuning
node tools/eval_assistant.mjs --holdout                  # 60 held-out questions
node tools/eval_assistant.mjs --set assistant_blind2     # a blind batch: run once, after changes
node tools/eval_assistant.mjs --verbose                  # print every answer
```

Every standalone question is scored twice: as the first message of a chat, and again after an unrelated
earlier question, because visitors ask in conversation. Write a new blind batch before each round of
tuning and run it once afterwards; that is the honest accuracy number.

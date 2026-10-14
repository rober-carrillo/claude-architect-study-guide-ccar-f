# Claude Architect Study Guide

An interactive study guide for the **Claude Certified Architect – Foundations (CCAR-F)** exam. It is a static site with no build step, no server and no dependencies to install, designed for about 8–10 hours of focused study.

It is based on the official exam guide v1.0 (effective July 2026). It is not affiliated with or endorsed by Anthropic, and the practice questions are written for this guide; they are not real exam items.

## What's inside

| Part | What it is |
|---|---|
| **Modules** (`modules/`) | One reading page per exam domain, plus an exam-overview page. Sections are organized by official task statement, with code skeletons, diagrams, "exam signal" and "trap" callouts, and embedded check-yourself questions. |
| **Practice** (`practice.html`) | 120 scenario questions (20 per official scenario). Each option has its own explanation. Drill by domain, scenario or missed questions, or take a **timed mock exam**: 4 random scenarios × 15 questions in 120 minutes, with flagging and a per-domain breakdown. |
| **Cases** (`cases.html`) | 12 worked incidents (two per scenario), each with three linked decisions over realistic evidence. |
| **Flashcards** (`flashcards.html`) | 150 cards across the five domains, using Leitner boxes. |
| **Cheat sheet** (`cheatsheet.html`) | Which mechanism to use, the harder and easy-to-miss facts, and a night-before recall list. |
| **Labs** (`labs/`) | Six hands-on labs that follow the official preparation exercises: an agentic loop, an MCP server, an extraction pipeline with the Batch API, Claude Code team config, a multi-agent SDK system, and a CI review bot. See [`labs/README.md`](labs/README.md). |

Progress (answers, studied sections, flashcard boxes, mock history) is saved in your browser's `localStorage`. It stays on that browser and device.

## Using it

Open https://*your-user*.github.io/claude-architect-study-guide/. 

Or open `index.html` in a browser. Pages load fonts, syntax highlighting (highlight.js) and diagrams (Mermaid) from public CDNs, so you need an internet connection for those. Everything else is local.

If your browser is strict about `file://` pages, serve the folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Suggested order: the home page has a 10-session plan. In short: exam overview → D1 → D2 → D3 → D4 → D5 → cases → mock exam → targeted drills → cheat sheet.

## Repository layout

```
index.html            home: plan, progress, links
modules/              exam.html, d1-agentic.html … d5-context.html
practice.html         drills, mock exam, missed questions
cases.html            worked incident cases
flashcards.html       Leitner flashcards
cheatsheet.html       one-page review
assets/css/style.css  shared styles (light and dark)
assets/js/app.js      shared behaviour: nav, theme, progress, question widget
assets/js/data/       question bank, cases, flashcards (plain JS data files)
labs/                 hands-on labs with starter code and solutions
tools/validate-data.mjs  checks every data file's shape
```

## Editing content

- **Questions** live in `assets/js/data/questions-*.js`. Each has `scenario` (1–6), `domain` (1–5), `task` (official task statement, e.g. `"1.4"`), `options`, `answer` (indices), one `rationale` per option, and a `takeaway`. Module pages show questions whose `task` matches a section's `data-tasks`.
- **Cases** live in `assets/js/data/cases.js`, and **flashcards** in `assets/js/data/flashcards.js`.
- After editing, run the validator (Node 18+):

```bash
node tools/validate-data.mjs
```

## Publishing to your own GitHub

```bash
# from this folder
git init -b main
git add .
git commit -m "Claude Architect study guide"
gh repo create claude-architect-study-guide --private --source . --push
# or, with an empty repo you created on github.com:
git remote add origin git@github.com:<you>/claude-architect-study-guide.git
git push -u origin main
```

To read it from any device, turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root). Pages on a private repo needs a paid GitHub plan; otherwise make the repo public.

## Sources

- Claude Certified Architect – Foundations Exam Guide v1.0 (Anthropic, July 2026). Download it from the Anthropic Partner Academy certification page. It isn't included here.
- Anthropic documentation for Claude Code, the Agent SDK, the Messages API and the Model Context Protocol.
- Candidate write-ups, used only for the "candidates say" notes on the cheat sheet.

# AGENTS.md — VERBAMIND Engineering & Collaboration Guidelines

## Project Overview
**VERBAMIND** is an online English speaking and placement communication coaching website (B.Tech AI/ML Final Year Project).
Core experience: Choose an exercise → Record speech → Analyse → Receive evidence-linked feedback → Practise → Retry → Compare improvement.

---

## Active Methodologies & Tool Responsibilities

1. **BMAD Method (`.agents/skills/bmad*`)**:
   - Primary planning and delivery workflow.
   - Used for PRD authoring, architecture definition, story splitting, and build-and-verify loops.

2. **Ponytail (`.agents/skills/ponytail`)**:
   - Guiding engineering principle: "Lazy senior dev" — minimal code, zero unneeded dependencies or boilerplate, robust architecture, and explicit testing of risky logic.

3. **Supporting Skills (`.agents/skills/tdd`, `.agents/skills/codebase-design`)**:
   - `tdd`: Test-driven development for high-risk business logic and edge cases.
   - `codebase-design`: Clean seams, deep modules, and modular interfaces.

4. **Karpathy LLM Wiki (`docs/wiki/`)**:
   - Persistent, compounding project knowledge base.
   - Contains indexed concepts, architecture notes, tools, and research.
   - Maintained with `index.md` and chronological `log.md`.

5. **Graphify (`skills/graphify`)**:
   - Used to generate and query codebase knowledge graphs once substantive code and documentation exist.

---

## Non-Negotiable Project Invariants

1. **Acoustic and Assessment Separation**:
   - Keep **Fluency**, **Reading Accuracy**, **Pronunciation**, and **Answer Relevance** strictly separate.
   - Never conflate an acoustic metric (e.g. pause duration or speech rate) with a linguistic metric (e.g. word error rate) or a semantic metric (e.g. content relevance).
2. **Scientific & Academic Integrity**:
   - Never invent mock assessment scores or fake research outcomes.
   - Clearly distinguish **Proposed**, **Implemented**, and **Verified** behavior in all documentation and code.
3. **Platform Scope**:
   - Web application only (React + TypeScript frontend, Python FastAPI backend).
   - No Flutter, React Native, or mobile app development.
4. **Security & Privacy**:
   - User audio recordings and transcripts are private data.
   - Never log raw audio payloads or commit recordings to version control.
   - Validate file mime types, byte size limits, and maximum audio durations.
   - Enforce resource ownership on sessions and recordings.
   - Never commit API keys, secrets, or credential tokens.
5. **Git Hygiene**:
   - Push to GitHub only when the user explicitly requests it.
   - Never force-push (`git push --force`) or commit untracked audio/data artifacts.
6. **Code Simplicity**:
   - Write clean, modular, self-contained code. Avoid premature microservice or complex abstraction sprawl.

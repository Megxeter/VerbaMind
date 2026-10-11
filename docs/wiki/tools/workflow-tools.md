# Development Toolchain & Workflow Roles

VERBAMIND combines five specialized tools with distinct, non-overlapping responsibilities:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT TOOL ROLES                          │
├───────────────────────────────┬────────────────────────────────────────┤
│ Tool                          │ Primary Responsibility                 │
├───────────────────────────────┼────────────────────────────────────────┤
│ BMAD Method                   │ Macro Planning & Delivery Loop         │
│                               │ (PRD, Architecture, Story Build)       │
├───────────────────────────────┼────────────────────────────────────────┤
│ Ponytail                      │ Micro Engineering Discipline           │
│                               │ (Minimal code, no bloat, test risks)   │
├───────────────────────────────┼────────────────────────────────────────┤
│ Matt Pocock Skills            │ Specialized Engineering Practices      │
│ (`tdd`, `codebase-design`)    │ (Test-first, deep seams)               │
├───────────────────────────────┼────────────────────────────────────────┤
│ Karpathy LLM Wiki             │ Compounding Knowledge Base             │
│ (`docs/wiki/`)                │ (Interlinked concepts, log, metrics)   │
├───────────────────────────────┼────────────────────────────────────────┤
│ Graphify                      │ Codebase Knowledge Graph               │
│                               │ (Visual dependencies & God-node query) │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## 1. BMAD Method (`bmad-code-org/BMAD-METHOD`)
- **Installed Skills**: `bmad`, `bmad-product-brief`, `bmad-prd`, `bmad-architecture`, `bmad-build`.
- **Location**: `.agents/skills/bmad*`
- **Role**: Drives the macro development lifecycle. Guides requirements definition, High-Level Architecture, and sprint story decomposition.

## 2. Ponytail (`DietrichGebert/ponytail`)
- **Installed Skill**: `ponytail`
- **Location**: `.agents/skills/ponytail`
- **Role**: The "lazy senior dev" ethos. Enforces writing the simplest solution that satisfies requirements, pruning dead code, avoiding bloated libraries, and rigorously testing risky business logic.

## 3. Matt Pocock Skills (`mattpocock/skills`)
- **Installed Skills**: `tdd`, `codebase-design`
- **Location**: `.agents/skills/tdd`, `.agents/skills/codebase-design`
- **Role**:
  - `tdd`: Red-green-refactor loop for critical logic (e.g., audio state transitions, WER calculation).
  - `codebase-design`: Crafting deep interfaces with minimal surface area.

## 4. Karpathy LLM Wiki (`docs/wiki/`)
- **Pattern**: Persistent markdown knowledge base with `index.md` and chronological `log.md`.
- **Role**: Preserves decisions, research on speech acoustic parameters, mathematical formulas, and viva explanations across sessions.

## 5. Graphify (`Graphify-Labs/graphify`)
- **Location**: Available in global Antigravity skills.
- **Role**: Will be triggered once implementation code files and relationships are established to produce a visual AST knowledge graph and dependency map.

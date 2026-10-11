# VERBAMIND Documentation Index

Welcome to the documentation repository for **VERBAMIND**, an AI/ML-assisted online English speaking and placement communication coaching platform.

---

## Documentation Structure

| Directory | Title | Description | Status |
| :--- | :--- | :--- | :--- |
| [`01-product/`](./01-product/) | Product Strategy | Product brief, scope, problem statement, user personas | Active |
| [`02-requirements/`](./02-requirements/) | Requirements | PRD, SRS, user stories, requirements traceability matrix | Active |
| [`03-specifications/`](./03-specifications/) | Feature Specs | Detailed functional specifications per feature | In Progress |
| [`04-architecture/`](./04-architecture/) | Architecture & ADRs | High-Level Design (HLD), system boundaries, and ADR log | Active |
| [`05-design/`](./05-design/) | Module Design | Low-Level Design (LLD), component contracts, state diagrams | Planned |
| [`06-implementation/`](./06-implementation/) | Implementation | Milestones, roadmap, daily work logs | Active |
| [`07-testing/`](./07-testing/) | Testing Strategy | Test plans, unit/integration test matrices, verification results | Active |
| [`08-security-and-privacy/`](./08-security-and-privacy/) | Security & Privacy | Threat models, audio data protection, authorization boundaries | Active |
| [`09-ml-and-research/`](./09-ml-and-research/) | ML & Research | Speech acoustic feature extraction, custom fluency model, evaluation on unseen speakers | Active |
| [`10-deployment/`](./10-deployment/) | Deployment | Environment configurations, containerization, hosting topology | Planned |
| [`11-operations/`](./11-operations/) | Operations | Monitoring, logging safeguards, health checks | Planned |
| [`12-policies/`](./12-policies/) | Governance & Ethics | Data retention policies, user consent, model bias considerations | Planned |
| [`13-learning-and-submission/`](./13-learning-and-submission/) | Viva & Submission | Academic report chapters, viva defense Q&A prep, weekly learning journal | Active |
| [`wiki/`](./wiki/) | LLM Knowledge Wiki | Compounding knowledge base: concepts, acoustic metrics, guides, and tool references | Active |

---

## Core Project Invariants
1. **Separation of Concerns**: Fluency, Reading Accuracy, Pronunciation, and Answer Relevance are assessed via dedicated, decoupled models and logic.
2. **Evidence-Linked Feedback**: Every score or suggestion must link to verifiable audio timestamps and transcript words.
3. **No Hallucinated Results**: Metrics and scores are never fabricated. Everything reflects verified computation.
4. **Data Privacy**: Private audio storage, strict session ownership, zero audio leakage in logs or Git.

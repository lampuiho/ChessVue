# Design questions found through journeys

This register holds focused questions about implemented design, scenario drift and gaps found while writing journeys. The [product intent](../JourneyTestPlan.md#product-intent-and-usability-baseline) establishes ease of use, recorded analysis, interactive analysis during play and multiple engine views as the main goals. Questions clarify the details of those capabilities; they do not make the capabilities optional.

Confirmed recording scope: analysis is recorded only for actual moves played in games. Exploratory moves are temporary and remain subject to the existing pruning policy. This is the resolved decision in Q-ANALYSIS-002; recording review prompts concern payload/capture details for actual game moves.

Questions should arise while implementing and testing journeys, backed by a concrete finding from that work. They are not an upfront design questionnaire or a prerequisite to starting. The existing speculative entries below are review prompts only; consult them when their journey is reached, and raise a focused question if implementation/testing demonstrates a real unresolved issue. The user permits useful early questions, but does not require them.

The scenario document is a working input, and implementation is evidence of current behaviour. Neither automatically resolves unclear design. Use the [scenario drift workflow](../JourneyTestPlan.md#scenario-drift-review-while-writing-journeys) for each affected journey.

## Structure

Keep one decision topic per Markdown file under its owning area, named `<question-id>-<Topic>.md`. Use stable IDs such as `Q-ANALYSIS-001`. Add a new area when needed rather than creating a general catch-all question file. This README is an index and workflow; detailed evidence and decisions stay in the topic files. Start from [Template.md](Template.md).

Each question records intent, observation, uncertainty, alternatives, a provisional recommendation, affected scenario/journey references and its eventual resolution. Link related questions instead of repeating their evidence. Keep execution evidence labelled separately from source inspection.

## Open questions

One follow-up clarification is open from design/source review of the analysis plan; it is not a finding from a new test run.

| ID | Status | Concrete question and reason |
| --- | --- | --- |
| [Q-PLAY-003](play/Q-PLAY-003-PausedAnalysisEntry.md) | Paused entry resolved; exploratory-input scope pending | Entry is now allowed by explicit user instruction. Existing rules separately lock analysis moves/history while paused; clarify that scope while keeping actual pause ownership intact. The topic records why a decision was needed. |

## Review prompts for future journey work

These planning hypotheses are not confirmed findings, active questions or blockers. Promote one to `Open` only when the relevant journey work produces concrete evidence that needs a product decision. Otherwise resolve it through the existing contracts and normal implementation judgement, or retire it.

| ID | Priority | Topic | Relevant work |
| --- | --- | --- | --- |
| [Q-ANALYSIS-001](analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) | P0 | Recorded content and capture timing for actual game moves | Actual-move recording/save journeys |
| [Q-ANALYSIS-003](analysis/Q-ANALYSIS-003-SuggestionInteraction.md) | P0 | Exploring an engine line versus submitting a live move | Analysis interaction journeys |
| [Q-ENGINE-001](engine/Q-ENGINE-001-ComparisonAndPersistence.md) | P1 | Engine comparison records attached to actual game moves | Multi-engine and recording journeys |
| [Q-UX-001](usability/Q-UX-001-UsabilityReference.md) | P1 | Concrete usability reference flows and review evidence | Composed sessions and usability review |

## Resolved questions

| ID | Resolved | Decision |
| --- | --- | --- |
| [Q-ANALYSIS-002](analysis/Q-ANALYSIS-002-VariationRetention.md) | 15 October 2026 | Record analysis only for actual game moves; exploratory moves remain temporary and the existing pruning policy is accepted |
| [Q-PLAY-001](play/Q-PLAY-001-LiveProgressDuringAnalysis.md) | 21 October 2026 | Analyse does not itself pause actual clocks/play; selected analysis and actual progression remain independent |
| [Q-PLAY-002](play/Q-PLAY-002-PremoveAnalysisConflicts.md) | 21 October 2026 | Premove/analysis conflicts resolved, including current-move pruning, historical retention and actual rewrite confirmation; implementation remains planned |

Initial implementation observations are from source inspection of the working tree based on commit `2d693f7` on 15 October 2026. They are not fresh browser test results. Provisional recommendations remain proposals; resolved decisions identify their source in the topic file. Recording these decisions has not changed runtime behaviour or the persistence schema.

## Working rules

1. Search existing questions before adding one. Link the exact scenario/branch, relevant contract, implementation entry point and case IDs; provide a minimal trigger that makes the uncertainty concrete.
2. Distinguish documentation drift, implementation defect, product gap and open design policy. A stale scenario label alone usually needs a documented correction rather than a new product decision.
3. Use `Review prompt` for a planning hypothesis. Use `Open` or `Investigating` only for an issue actually encountered while authoring/running a journey; record the case, trigger, evidence and why existing guidance cannot settle it. `Resolved` and `Deferred` record actual dispositions. A prompt never blocks a test; a concrete open question affects only the dependent assertion, without removing existing regression coverage.
4. Record current behaviour as characterisation where useful. Do not label a passing characterisation as acceptance of a policy that conflicts with user intent. Do not silently weaken assertions or rewrite scenarios to make a result green.
5. Resolve routine implementation details within the established intent. Ask focused questions as they arise during journey implementation/testing, with a concrete example and proposed direction. Useful early questions are allowed, but do not require speculative questions to be answered before beginning or ask the user to re-approve the whole plan.
6. When a decision is made, record its source/date and rationale in the same file. Update high-level scenarios/contracts, affected design, fixtures and journey expectations together, preserving IDs and noting any schema/migration implications.
7. Leave resolved files as decision history, move their index row to a resolved section, and link superseding questions if a decision changes. Aggregate status and dependent cases in reports without copying every question into a giant JSON or Markdown register.

This index is an initial set, not a complete design audit. Add other questions when journeys reveal them, including concerns that the high-level scenarios never considered.

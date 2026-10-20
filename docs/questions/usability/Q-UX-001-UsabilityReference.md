# Q-UX-001 — Which reference flows define ease of use?

| Field | Value |
| --- | --- |
| Status | Review prompt |
| Priority | P1 |
| Classification | Usability acceptance clarification |
| Raised | 15 October 2026 |
| Reviewed revision | User-provided reference and source review based on `2d693f7`; no reference-site comparison performed |
| Related questions | [Q-ANALYSIS-003](../analysis/Q-ANALYSIS-003-SuggestionInteraction.md), [Q-PLAY-001](../play/Q-PLAY-001-LiveProgressDuringAnalysis.md) |

This is a planning review prompt, not a question currently awaiting an answer or blocking journey work. Investigate it when implementing/testing the relevant journeys; raise a concrete question only if that work reveals a real unresolved issue.

## User intent

The user considers chess.com the gold standard for ease of use. The confirmed additions for this app are recording analysis, interactive analysis while playing and multiple engine views. The reference is a usability benchmark, not a request to copy every feature or visual detail.

## Observation and evidence

- [High-level scenarios](../../HighLevel/scenarios.md) mostly enumerate functional steps, branches and implementation touchpoints; they do not establish whether the combined play/analysis experience is easy to understand.
- The [journey plan](../../JourneyTestPlan.md) provides composed sessions and keyboard/layout checks, but needs product-oriented review evidence beyond successful clicks and rendered panels.
- No particular current behaviour of chess.com has been verified in this work. Do not infer its analysis, timing or engine policies from the user's reference alone.

## Decision to clarify

Which concrete reference flows and observable usability outcomes should be used to assess this app's playing/analysis experience? Where a reference flow does not cover recording or simultaneous engines, what clear interaction should ChessVue provide?

## Alternatives and provisional direction

- Start from familiar board play and history navigation, then assess the additional analysis tools in context.
- Use an observed play → explore → return flow as the main interaction reference, alongside actual-game-move analysis records and multiple engines.
- Broaden into a full interface comparison, which costs more and may pull unrelated features into scope.

Proposed starting point: review three short tasks—play a move and revisit its recorded analysis, explore/return without recording exploratory moves, and compare two engines—before broad visual redesign. Observe discoverability, mode/turn clarity, accidental actions, ability to recover and whether actual-move analysis records can be found again. Set quantitative thresholds only after a baseline review.

If a specific reference-site behaviour becomes part of the rationale, inspect it or its current primary documentation and record the source, date and access limitations. Clearly label adaptations and inferences. Do not invent equivalent flows for features the reference does not establish.

## Journey impact

Affected cases: JRN-SESSION-01/02/03/04, JRN-UX-01/02/03 and the entry/return actions in JRN-HIST-05. Functional automation can proceed; add a focused manual usability review with observed friction and linked design questions.

Discovering another concern should create a specific follow-up question or defect, not automatically expand all journeys or introduce a new mandatory feature.

## Resolution

Assess the concrete tasks while implementing/running journeys, record observed friction, and raise a focused question if needed. Selecting reference tasks in advance is not a prerequisite to beginning the functional work.

## Focused review on 20 October 2026

[JRN-UX-01–04](../../../journeys/definitions/usability/ScenarioReview.md) adds keyboard/dialog acceptance, the desktop layout matrix and a repeatable resource workload. The keyboard tasks exposed missing focus ownership and promotion dismissal; the 150% desktop checks exposed horizontal overflow and oversized pieces. These defects have focused fixes and executable regression assertions, without changing play/exploration/recording policy.

Screenshot inspection at 800×600 shows a complete board followed by the sidebar, correctly wrapped game/snapshot names, and no page-wide horizontal overflow. The 32-snapshot library spans 2,858 CSS pixels at that size; its action footer requires substantial scrolling from the selected details. The board's 64 Tab stops and abbreviated workspace titles are further concrete friction observations. Arrow-key board navigation and a persistent library action area are possible follow-up improvements, not newly mandatory acceptance rules. The [verification record](../../JourneyImplementation.md#usability-verification) records the screenshots, measured workload and limits.

This review does not compare current reference-site behaviour or establish human ease of use, screen-reader compatibility or native-host acceptance. No product-policy decision is needed to complete the independent keyboard, focus, desktop layout and resource checks.

## Viewport and navigation correction

The user's follow-up rejects document scrolling on desktop and supplies a chess.com screenshot showing a borderless player strip with its avatar aligned to the board. This is a supplied visual reference, not an assertion about the current external site's behaviour.

The accepted correction uses the existing `#app` root, a flex-positioned collapsible left navigation rail on desktop, an icon-only mobile top bar with an overlay drawer, and flat board/player/sidebar/library/settings surfaces. Board size accounts for available width and height. Long lists and forms scroll internally with hidden scrollbar chrome, while player strips, game controls and route actions remain in view. This supersedes the earlier review's acceptance of vertical document scrolling and distant library actions. The 64 board Tab stops and abbreviated titles remain separate observations.

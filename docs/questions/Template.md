# Q-AREA-NNN — Decision topic

| Field | Value |
| --- | --- |
| Status | Open |
| Priority | P0 / P1 / P2 |
| Classification | Documentation drift / implementation defect / product gap / open design question |
| Raised | Date |
| Discovery | Journey case, implementation/testing stage and concrete finding that raised this question |
| Reviewed revision | Source/document revision; include relevant working-tree changes |
| Related questions | Stable IDs and links, or none |

## User intent

State the relevant confirmed user goal and link its source. Separate that goal from details that have not been decided.

## Observation and evidence

Create an active question when this issue is encountered while implementing/testing a journey. A planning hypothesis stays a non-blocking `Review prompt` until then.

- Scenario/branch: link the owning high-level section and identify the exact wording or missing case.
- Contract: link state, persistence, engine or settings constraints as relevant.
- Implementation: link the responsible code and name the behaviour/entry point.
- Reproduction: starting state, UI actions and resulting observation.
- Evidence type: source inspection, reproduced UI result or automated run; include revision/date and trace reference where available.

## Decision to clarify

Write one focused question, explain why the existing sources do not settle it, and state its user-visible consequence.

## Alternatives and provisional direction

List meaningful alternatives with their usability, data and implementation effects. Label any recommendation as a proposal; do not present it as an agreed decision.

## Journey impact

List affected `JRN-*` IDs and the exact acceptance assertion awaiting this decision. Explain which independent assertions/characterisation tests can proceed, and whether fixtures or persistence contracts would change.

## Resolution

Pending. On resolution, record the decision, source/date, rationale and affected document/test changes. Include evidence that the scenario/contract, implementation and journey expectations have been reconciled. A deferred decision remains unverified acceptance.

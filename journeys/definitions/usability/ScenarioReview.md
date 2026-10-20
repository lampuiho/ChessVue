# Usability scenario review

Reviewed on 20 October 2026 against `e141840` plus the usability working-tree changes, following the completed journey and ownership cleanup. The acceptance scope is [JRN-UX-01–04](../../../docs/JourneyTestPlan.md#interaction-and-presentation-checks). These checks cross existing flows; they introduce no new chess rule, recording policy or reference-site parity claim.

The owning [scenarios](../../../docs/HighLevel/scenarios.md), [UI layout](../../../docs/HighLevel/ui_layout.md), [state](../../../docs/HighLevel/state_model.md), [persistence](../../../docs/HighLevel/persistence_contract.md), [settings](../../../docs/HighLevel/settings_contract.md) and [engine runtime](../../../docs/HighLevel/engine_runtime.md) remain the behavioural contracts. Recording and temporary exploration retain the decisions in [Q-ANALYSIS-002](../../../docs/questions/analysis/Q-ANALYSIS-002-VariationRetention.md). [Q-UX-001](../../../docs/questions/usability/Q-UX-001-UsabilityReference.md) supplies the qualitative review direction; no uninspected external site behaviour is asserted.

## JRN-UX-01

Home → custom creation → board selection/move → named save → Settings → return is performed with Tab/Shift+Tab, Enter and text entry, without locator focus or mouse actions. Both colours' promotion journeys inspect all four accessible names, cancel with Escape, return focus to the destination square and complete a named choice. Selection is exposed as `aria-pressed`. Existing board glyphs and rules remain unchanged.

Source review found no initial dialog focus, focus containment or return-focus owner; a board-local promotion chooser also lacked keyboard dismissal. `FocusScope` now owns these effects for the exact rendered surface through directive mount/unmount, without observers or async invalidation. Settings toggles and scale receive meaningful accessible names, hidden menu text retains an explicit name, and invisible checkbox/radio inputs highlight their visible proxy on keyboard focus. The alternate host promotion buttons now also have piece names.

The board currently has 64 Tab stops. This is usable by keyboard but creates navigation effort; the suite exercises the actual order rather than silently jumping focus. A roving board cursor/arrow-key design remains a possible separate improvement, not an inferred requirement for these journeys. Tab titles and workspace headings may intentionally abbreviate long names; their complete names remain in text and title tooltips.

## JRN-UX-02

Overwrite confirmation → write error → held retry verifies focus stays in the active surface, including when every action is disabled, a repeated confirmation starts one write, busy dismissal is blocked, successful completion restores the save action, and errors permit a fresh attempt. Import errors cover Escape/backdrop dismissal and focus return. Dirty-settings cancellation preserves the draft and returns to its launcher. Local draw offer → draw resolution explicitly transfers focus, contains Tab traversal and rejects Escape/backdrop dismissal until Accept/Decline.

The focus owner stack records actual mounted elements and their launchers. Nested owners restore to their parent, removed launchers use a surviving parent or route action, and every owner removes its listeners on disposal. Native focus loss after disabling a focused action moves focus to the dialog itself when no control remains; it does not reclaim focus from another window. Mounted tests cover nested ownership, disabled/hidden controls, busy/empty dialogs and repeated cleanup. Different modal kinds have separate DOM identities so chained dialogs initialise focus at each activation.

## JRN-UX-03

The matrix crosses 1440×900 and 1024×768 CSS-pixel viewports with the application's supported 75/100/150% interface scale, White/Black orientation and Light/Dark theme: 24 independent contexts. It uses the normal Settings UI and checks the rendered font size, resolved theme and board order. This is application scale, not OS DPI or browser zoom.

The workload seed provides long names, a 160-ply mainline and nested alternatives. Assertions check both document dimensions and zero document scroll, square-board geometry, avatar alignment, borderless player rows, gameplay controls, menu actions, nested history/return, custom form/submit and library selection/details/actions. Internal panel scrolling remains available without visible scrollbars. Screenshots accompany layout assertions; geometry alone does not establish contrast, readability, ease of learning or assistive-technology compatibility.

The user's follow-up replaces the earlier vertically scrolling acceptance with a viewport-bounded flex layout. Desktop navigation is a collapsible left rail; the mobile icon bar opens a focus-contained drawer over a black overlay. Seven additional variants cover both rail states and route retention, 375×667/812 mobile menus, drawer focus/dismissal/route actions and resize, position-editing/player-text geometry, mobile Save/Settings action areas and Home actions. The original 800×600 screenshots document the rejected design, not the current acceptance contract. [Q-UX-001](../../../docs/questions/usability/Q-UX-001-UsabilityReference.md#viewport-and-navigation-correction) records the correction and the supplied chess.com screenshot's flat player-strip direction.

## JRN-UX-04

The reproducible seed has 160 legal knight-cycle plies, eight nested alternative nodes and 32 named snapshots plus one autosave. Named snapshots contain successive two-ply prefixes (2–64 plies); the newest autosave restores the complete 160-ply tree. This keeps the fixture within the journey adapter's real session-storage quota while retaining distinct historical snapshots. Threefold/fifty-move adjudication is outside the current rules baseline. Every snapshot is a real serialised game; fixture validation checks legal continuations, canonical round trips and actual session-storage initialisation. Reset creates independent documents.

One warm-up and twelve measured cycles each select first/live history, browse a different snapshot, visit Settings and return, open/dismiss creation, and add/start/stop/remove Journey A. Every cycle must return to the warm-up's active process, process-listener, pending-search, timer, persisted open-game, visible-tab and selected document/window listener counts. A single game deliberately has no visible tab strip. Closed diagnostic records intentionally remain available and are not counted as active sessions. A final UI save verifies the mainline and rendered path are retained.

The test attaches `workload-baseline` with workload, viewport, counts and all action-group durations. These include browser automation and storage work; they are a reproducible initial baseline, not engine throughput or a heap-leak proof. Normal 15-second action and 180-second test deadlines detect loss of responsiveness; there is no invented performance percentile budget. The probe is test-only, observes explicit document/window event registrations and does not change production lifecycle ownership.

Execution evidence and measured findings belong in [JourneyImplementation.md](../../../docs/JourneyImplementation.md#usability-verification), rather than being inferred from discovery or this review.

# Rules scenario review

Reviewed on 18 October 2026 against source/document revision `d0985ac` and this tranche. Owning flows: [SCN-MOVE-01/02](../../../docs/HighLevel/scenarios.md#scn-move-01---legal-move-on-board), SCN-CTRL-01, SCN-SAVE-03 and SCN-SESSION-02, including their complete branches. Reviewed the [state](../../../docs/HighLevel/state_model.md), [persistence](../../../docs/HighLevel/persistence_contract.md) and [settings](../../../docs/HighLevel/settings_contract.md) contracts, Chessboard legal targets, GameRuleUtility, move application/history, result transitions, clocks and restoration. Product intent is safe, understandable play with preserved game state; actual-move recording and temporary exploration keep their established boundaries. No engine, recording or exploration policy changes are required.

The four default tabs expose both colours' castling and immediate en passant. Named variants isolate forbidden castling, king safety and paused timed draw precursors. Roots and seeded histories are validated through the existing rules and canonical serialisation. Draw fixtures start ongoing; a normal UI move must cause adjudication. Source inspection initially found the implemented chess rules aligned with the requirements. Execution results and any defects belong in [Rules verification](../../../docs/JourneyImplementation.md#rules-verification).

All 50 browser variants subsequently passed without retries or global errors; all six groups are accepted. The run confirmed the outcomes described below and required no application-rule correction. Forty root/history round trips plus the stable-default/unknown-variant check passed in the focused fixture suite.

## JRN-RULE-01

SCN-MOVE-01 and SCN-CTRL-01 / BR-CTRL-01-NO-MOVES. Classification: aligned. Four independently reset variants castle each way for each colour, checking exact legal king targets, both relocated pieces, SAN, a single committed live node, turn, captures and both removed rights. Takeback restores the complete prior canonical game and permits castling again. Rights are stored in the root plus move history and reconstructed at the selected node; no redundant current-position field is required.

## JRN-RULE-02

SCN-MOVE-02 and SCN-MOVE-01. Classification: aligned. Twenty variants cross both colours/sides with check, an attacked transit square, occupied path, a returned king and a returned rook. Queenside occupancy specifically uses b1/b8, which the king does not cross but the rook must. Movement-related rights loss comes from four legal moves, rather than manually disabled rights. Each rejected destination is absent from the legal map and preserves every board label, history, source-save bytes and the canonical game including clocks, paths and captures. A legal king move confirms input recovers.

## JRN-RULE-03

SCN-MOVE-01/02 and SCN-CTRL-01. Classification: aligned. Four variants cover immediate and expired en passant for each colour. A legal seeded double push establishes the target. Immediate capture removes the adjacent pawn, records en-passant kind/SAN/material, clears the target and restores the opportunity on takeback. A quiet move and opponent reply expire the opportunity; rejection preserves the pawn and full game, and ordinary pawn advancement remains legal.

## JRN-RULE-04

SCN-MOVE-01/02. Classification: aligned. Eight variants cover both colours' pinned rook, defended king capture, double check and pinned en passant that would expose the king. Exact highlighted destinations are checked; a double-checked side has no rook targets and only safe king responses. Invalid attempts preserve the canonical game and files, then a legal evasion/continuation commits. This extends the baseline with en-passant self-check without expanding adjudication policy.

## JRN-RULE-05

SCN-MOVE-01 / BR-MOVE-01-GAME-OVER, SCN-SESSION-02 and SCN-SAVE-03. Classification: aligned with a documentation clarification: game-over includes stalemate and insufficient material as well as checkmate. Eight variants cross both colours with stalemate, bishop-only, knight-only and bare kings. Each starts paused and ongoing, resumes controlled live time, then makes the adjudicating move. Assertions require one live move, a rule-resolved draw, analysis state, stopped clocks including the final increment, no live controls, stable result during history review and unchanged canonical restoration. Later timer ticks cannot create timeout/duplicate result operations. No fifty-move, repetition or timeout-material rules are added.

## JRN-RULE-06

SCN-SAVE-03, SCN-SESSION-02 and SCN-MOVE-01. Classification: aligned. Six variants save and reload each colour's two castling choices and en passant both before and after committing. Complete canonical games, reconstructed rights/target, board, SAN and captured material survive. A normal opponent response proves continuation is legal and source named snapshots stay byte-identical. Reload uses the ordinary startup/session path without resetting the fixture.

The unrelated stale-position, promotion, out-of-turn, overwrite/cancellation and restore-failure branches remain owned by their existing suites or Engine races. Their scenario membership is not claimed as new Rules acceptance. There is no unresolved product question for these six groups. Broader usability assessment remains in JRN-UX.

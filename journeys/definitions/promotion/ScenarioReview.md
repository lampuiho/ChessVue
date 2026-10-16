# Promotion scenario review

Reviewed on 16 October 2026 against source revision `c225e1d`, plus this tranche's changes. Owning flows: [SCN-MOVE-01/02/03](../../../docs/HighLevel/scenarios.md#scn-move-03---pawn-promotion-resolution), takeback, session restore and named-save confirmation. Constraints: [state](../../../docs/HighLevel/state_model.md), [settings](../../../docs/HighLevel/settings_contract.md), [persistence](../../../docs/HighLevel/persistence_contract.md) and [gameplay process](../../../docs/LowLevel/ProcessFlows/GameplayAndControl.md) contracts. The original two IDs, positions, local players, takeback permission and untimed defaults remain in owned fixture data. Every browser variant resets independently; reload omits reset.

Intent: require an explicit promotion choice, preserve the attempted position until a choice commits, honour every underpromotion, and restore the same canonical workspace. Actual-move recording and temporary exploration retain their existing boundaries. No new promotion preference, position-validation policy or unresolved design decision is introduced. Execution evidence belongs in the generated journey report and [implementation record](../../../docs/JourneyImplementation.md#promotion-verification).

Observed outcomes below were confirmed by all 36 promotion variants in both the focused run and the complete seeded suite, without retries. Source inspection and the initial accessibility/documentation findings are distinguished from that execution evidence; each required promotion assertion is accepted.

## JRN-PROMO-01

SCN-MOVE-03 / BR-MOVE-03-CANCEL, with the SCN-MOVE-02 no-mutation boundary. Source inspection: pending choices belong to Chessboard and Cancel clears selection before emitting a move. Four independently reset variants cover both colours and quiet/capture attempts. Assertions compare all 64 square labels, history, captures, turn, canonical game and file bytes; a different legal king move proves selection recovers. Classification: aligned behaviour; documentation drift corrected from shared modal/palette to the inline chooser.

## JRN-PROMO-02

SCN-MOVE-03 and SCN-MOVE-01. Eight variants choose queen, rook, bishop and knight for each colour. The inline chooser exposes a labelled group and explicit colour/kind button names; glyph-only choices were an accessibility defect corrected in this tranche. Tests assert the source/target, remaining rook, material count, turn, exact SAN and one live promotion node with the selected kind. All quiet fixture outcomes are ongoing without check. Every variant joins `@smoke`. Classification: aligned chess behaviour; accessible-name defect corrected.

## JRN-PROMO-03

SCN-MOVE-03 and SCN-MOVE-01 / BR-MOVE-01-GAME-OVER. Eight capture variants verify the removed rook, the capturing player's material display and exact promotion/capture notation. Queen/rook capture promotions check the opposing king and remain ongoing; bishop/knight capture promotions leave only king plus minor piece against king and therefore draw under the existing insufficient-material rule. Saved check/result/state fields must agree with the rendered outcome. Underpromotion is never substituted with a queen. Classification: aligned; no new rule policy.

## JRN-PROMO-04

SCN-MOVE-01/03. Twelve variants cover both colours and quiet/capture moves by dragging in white and black orientations, plus clicking in black orientation. Orientation changes through Settings and Save; physical first/last square labels confirm the board actually rotated. Representative knight and rook choices use the same source/target, SAN, captures, turn and canonical move assertions as click play. Classification: aligned coordinate and gesture semantics.

## JRN-PROMO-05

SCN-MOVE-03, SCN-CTRL-01 / BR-CTRL-01-NO-MOVES, SCN-SESSION-02 and SCN-SAVE-03. Four variants save/reload each colour's quiet rook or capture knight promotion, including rule-resolved draws. They compare the complete restored canonical game through a fresh UI save, then take back to the exact pre-move workspace. Pawn, captured rook, empty destination, captures, turn, root history, result, selector paths and takeback availability must recover. The promoted named snapshot remains byte-identical and a different promotion can be played after takeback. Classification: aligned persistence and takeback contracts.

The complete owning move scenarios and their stale-position, game-over, same-square, out-of-turn and cancellation branches were reviewed. This tranche accepts promotion-specific paths; broader invalid-input and asynchronous race coverage stays with Play and Engine races. The promotion Planned label and shared-modal touchpoints were stale: the current inline surface needs no UiStateStore modal or separate PiecePalette. High-level and low-level wording is reconciled without changing promotion policy.

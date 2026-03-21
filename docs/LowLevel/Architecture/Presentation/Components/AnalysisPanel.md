# AnalysisPanel

## Purpose
Render the latest visible analysis snapshot for the active position.

## Consumes
- visible analysis snapshot from `AnalysisStore`
- per-engine availability and failure state

## Emits
- `refreshRequested`
- `engineRetryRequested`
- `engineSelectionRequested`

## Notes
- Each engine row updates independently.
- Saved analysis may remain visible when live engines are unavailable.

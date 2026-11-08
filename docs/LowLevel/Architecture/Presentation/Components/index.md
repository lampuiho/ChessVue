# Components

## Common Components
`src/components/common`: [Common Components](Common/index.md)
- [AppIcon](Common/AppIcon.md)
- [ChessPiece](Common/ChessPiece.md)
- [ControlButton](Common/ControlButton.md)
- [ExpandableText](Common/ExpandableText.md)

## Modal Components
`src/components/modals`: [Modals](Modals/index.md)

## Shell Components
- [NavigationFrame](NavigationFrame.md)
- [MenuBar](MenuBar.md)
- [GameTabs](GameTabs.md)

## Game Workspace Components
- [Chessboard](Chessboard.md)
- [PlayerPanel](PlayerPanel.md)
- [HistoryPanel](HistoryPanel.md)
- [AnalysisPanel](AnalysisPanel.md)
- [GameControlPanel](GameControlPanel.md)

## Game Configuration Fields
Shared by `GameCreationModal` and the Gameplay settings category.
- [GamePlayerField](GamePlayerField.md)
- [GameClockFields](GameClockFields.md)
- [AnalysisSnapshotFields](AnalysisSnapshotFields.md)

## Rules
- Feature components in `src/components` render their own surface with global CSS classes. Common components are small reusable drawing or control primitives; modal components render inside the shared `ModalDialog` shell.
- Feature components call existing store actions locally when they own the complete interaction. Events cross an actual ownership boundary, such as captured board input, playback, Menu interruption or modal dismissal; see the [Interaction Map](../InteractionMap.md).
- Components render derived state but do not own persistence, rule evaluation or engine lifecycle.
- Read mutable game fields and arrays through their existing reactive owners; no revision prop or manual publication layer is used.
- Extract a component only where there is actual shared use or a distinct owner, without adding prop/event relays solely to preserve an extra component layer. See [Markup and Ownership Rules](../index.md#markup-and-ownership-rules).
- Each component's styles live in the global stylesheet named in its doc; there are no component style blocks.

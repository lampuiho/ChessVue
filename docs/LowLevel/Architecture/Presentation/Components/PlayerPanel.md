# PlayerPanel

Props are `gameId`, `colour`, `remainingMs`, `active`, `selectionDisabled` and `capturedPieces`. There are no emits. The panel reads its colour's player and shallow-reactive engine status from the canonical game.

The player-label action opens PlayerSelectionModal locally with the game ID and colour. The modal captures its initial player from that game, preserving an existing copied engine when Keep is selected even if its configured profile changes. Board editing and the view's playback lock disable selection; genuine pauses still permit reassignment.

GameView retains one clock timer, the actual live-turn projection and one captured-material traversal for both strips. It supplies remaining time, active status and captured groups so those displays agree with their shared source. Board orientation selects which colour appears in each strip.

The panel owns its SVG/player/readout markup and uses global CSS. Gameplay controls remain in GameControlPanel; engine failure feedback stays beside the affected seat.

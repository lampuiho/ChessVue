the goal of the app is to allow player to play chess against a chess engine while having multiple different chess engines analysing the board and suggest an evaluation score (who is at advantage and by how much, this will expand later hopefully with explanation of the score)

first step I need a high level design of the app. On this page, I will list unorganised ideas to be organised into a software architecture that can be implemented in parts. Architecture should detail the connection of all these components (UI/global state store/composable/external software). with this architecture, we can design the interfaces for these components to connect them together with individual documents and implemented.

this will be the frontend, implemented with vue app, to be incorporated into nwjs or electron.js or capacitor.js to interface with chess engines, on different platforms like windows, android, iOS, web, MacOS, etc

game state, positions, analysis and settings,etc are to be data driven, serialisible and restored from any state.

Window should have a top menu for loading game, starting new game, and configuring settings and potentially other things. 

tabs for various games (hide tab if it's the only game1)

use router to navigate to different games and views (like settings)

Game view should have a top row and a bottom row to display the player (or the engine) and captured pieces. For engines, can also display top lines of thoughts (probably something for the future for now). right panel for time other engine's ananlysis, 

Will think about design of mobile aspect ratio later but leave that option open.

should be responsive so use rem for every size styling

visual customisation like chess pieces and board colour should also be left possible


- rewrite deferred move flow and pause game so that it follows the same player turn flow. this is so when making moves outside of a player turn, moves just get appended to the deferred move list. required to allow premoves. check in request engine move position.`requireGameRuntime(game).pendingPlayerTurnPromise !== pendingPlayerMove` doesn't make a lot of sense either. Because each player takes turn so there should only be only a single valid turn promise and never left any unresolved turn promise. Should have made sure another promise is not made in the first place. moves not meant for the current position will need to be validated. So need a good think about...

## Code cleanup follow-up

See [CodeCleanupPlan.md](CodeCleanupPlan.md) for the inspected sites, dependencies and acceptance checks.

- [ ] Remove remaining generation-based async invalidation and review turn/playback ownership, coordinated with the turn-flow item above.
- [ ] Replace watcher-driven orchestration with explicit actions/events/lifecycle owners; justify and restrict any retained boundary watchers.
- [ ] Remove unnecessary implementation `: void` and `: Promise<void>` annotations while preserving required callable contracts.
- [ ] Add static enforcement for the agreed generation, watcher and return-inference rules.

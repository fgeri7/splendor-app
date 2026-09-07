Splendor v3.29 – Rules Audit Fixes

Based directly on v3.28.

Fixes found during gameplay-rule testing:
- A turn that leaves the player with more than 10 tokens now correctly stays on the same player until the required token discard is completed.
- Token-taking, reserving and card-purchasing actions no longer advance the turn while the discard step is pending.
- End-of-turn noble selection correctly blocks turn advancement while a multi-noble choice is pending.
- Action functions are guarded after the game has ended.

Validated with synthetic gameplay tests covering:
- 10-token limit and discard flow
- identical-token bank requirement
- hidden reservation and gold handling
- 3-card reservation limit
- card affordability/payment with bonuses and gold
- 15-point end-game trigger and final round
- tie-break by number of purchased development cards
- multi-noble selection persistence
- single eligible noble auto-acquisition
- saved multi-noble choice reload
- no actions after game over

No intentional UI redesign or unrelated gameplay change.

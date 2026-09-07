Splendor v3.30 – Rules Audit Fixes

Based directly on v3.29.

Fixes found during the continued rules audit:
- Fixed a card-purchase turn-advance bug that could advance the game twice after a normal purchase.
- Implemented the official 1- or 2-token version of the "take 3 different colors" action when fewer than 3 different colors are available in the bank.
- Fixed end-game tie handling: equal points are resolved by fewest purchased development cards; if still tied, the players share the victory.
- Updated the game-over overlay and turn banner to represent shared victories.
- Removed a duplicated turn-change animation call.
- Cleaned up duplicated markup in the multi-noble selection panel.

Retested:
- normal token actions advance exactly once
- normal card purchase advances exactly once
- 1/2/3 different-color token taking
- 10-token discard flow
- 15-point final-round trigger
- fewest-card tie-break
- exact tie after tie-break -> shared victory
- multi-noble selection

No intentional visual redesign. Existing v3.29 UI and approved interaction behavior are preserved.

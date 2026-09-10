Splendor v3.34 – Rules & Robustness Fixes

Based directly on the audited v3.33 working files. No intentional visual redesign.

Fixes:
- Enforced the Splendor rule that a player may claim at most ONE noble during a single turn. If multiple nobles become eligible, exactly one is selected; any remaining eligible noble can be claimed automatically on a later turn if it is still available.
- Noble-choice finalization now verifies that the selected noble was actually part of the eligible choices for that turn.
- Taking different-colour gems now follows the official edge case: with 3+ colours available, take exactly 3 different colours; with only 2 colours available, take 1 or 2 different colours; with only 1 colour available, take 1.
- Added the zero-token pass only for the true deadlock case where no other legal action exists.
- Hardened saved-game loading against malformed v2 state and migrated old saves with >10 tokens into mandatory discard mode.
- Action buttons are visibly disabled while mandatory discard or noble choice is active.
- Clearing the game log is now persisted across reloads.
- Global text-selection/context-menu/drag listeners are installed only once.
- Escaped player names when inserted into HTML to prevent HTML injection/XSS through a player name.
- Noble selection is persisted immediately after choosing an option.
- Service-worker cache bumped to v3.34.

Validation:
- JavaScript syntax check passes.
- ZIP integrity check passes.
- Existing v3.33 race/reset protections retained.
- Existing approved visual/layout files are unchanged.

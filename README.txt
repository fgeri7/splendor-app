Splendor v3.33 – Rules Audit Fixes

Based directly on v3.32.

Fixes found during continued audit:
- Prevented rapid double-tap card selection from queuing multiple asynchronous purchase/reserve callbacks in the same turn.
- Temporarily locks the action buttons during the short card-selection feedback animation, preventing stale callbacks after an action change.
- Added data.js to the service-worker app shell so the game data is available to the PWA cache for offline reloads.

Retested:
- rapid double card selection -> exactly one callback
- selection lock releases after the 220ms preview
- action buttons are disabled during the preview
- JavaScript syntax check passes
- service-worker cache version updated to v3.33

No intentional visual redesign. Existing approved UI and gameplay behavior are preserved.

- persistent discard state prevents bypassing the mandatory >10-token discard step and survives reload
- zero-color take-3 edge case blocked
- action controls are disabled during discard/noble-choice/selection preview and restored for a new game

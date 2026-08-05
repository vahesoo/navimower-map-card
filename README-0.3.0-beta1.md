# Navimower Map Card 0.3.0-beta1 notes

Navimower Map Card `0.3.0-beta1` uses the completed-session render archives provided by Navimower integration `0.4.0-beta1` or later.

- Only the active session is drawn as a live line.
- Completed sessions are SVG mowed-area footprints with separate dock, pause, return, and inter-zone travel strokes.
- Completed point trails and old daily line trails are not retained as a fallback.
- History dates are derived from the retained session index.
- The schedule dialog closes after a successful batch save.
- The card is constrained to its allocated dashboard width and map-detail outlines keep a stable visual weight.

The normal installation and YAML configuration remain unchanged. HACS installs the JavaScript modules from `dist/` and loads `navimower-map-card.js` as before.

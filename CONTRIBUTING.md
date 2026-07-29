# Contributing

Issues and pull requests are welcome.

## Local checks

The project has no runtime dependencies.

```bash
npm test
```

`src/navimower-map-card.js` is the source file. Run `npm run build` after changes so the matching HACS file in `dist/` is updated.

Please test UI changes in at least:

- a desktop browser;
- Android Chrome or the Home Assistant Companion App;
- a dashboard using Sections view.

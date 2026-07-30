# GitHub release checklist

1. Update `package.json` to the intended release version.
2. Update the version header and `NAVIMOWER_MAP_CARD_VERSION` in `src/navimower-map-card.js`.
3. Add the release entry to `CHANGELOG.md`.
4. Update README examples and terminology when configuration or map-data fields change.
5. Run `npm test` and confirm the build, JavaScript checks, and smoke tests pass.
6. Confirm `dist/navimower-map-card.js` exists and contains the intended runtime version.
7. Commit and push all source, generated distribution, and documentation changes.
8. Create and publish a GitHub release using a matching tag such as `v0.1.6`.
9. Do not publish the release as a draft or pre-release unless that is intentional.
10. In HACS, run **Update information** and confirm the new version is offered.
11. Install the release and verify the resource path `/hacsfiles/navimower-map-card/navimower-map-card.js`.
12. Hard-refresh the Home Assistant frontend and test desktop, mobile browser, and the Home Assistant app.

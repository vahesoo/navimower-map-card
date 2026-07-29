# First GitHub release checklist

1. Create a public GitHub repository named exactly `navimower-map-card`.
2. Upload the contents of this package to the repository root, not the containing folder itself.
3. Confirm that `dist/navimower-map-card.js` exists on the default branch.
4. Open the Actions tab and confirm that both validation jobs pass.
5. Create a GitHub release and tag named `v0.1.1`.
6. In HACS, add the repository as a custom repository with category **Dashboard**.
7. Download the card and confirm that Home Assistant creates the `/hacsfiles/navimower-map-card/navimower-map-card.js` resource.
8. Test the card in desktop Chrome, Android Chrome, and the Home Assistant Android app.
9. Keep the old bundled `/local/navimower/` resource until this card has passed testing.
10. Remove the bundled card from the Navimower integration only after the separate repository works reliably.

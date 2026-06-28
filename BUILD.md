# Build Guide

## Commands

Development build:

```bash
npm run build
```

Production build:

```bash
npm run build:prod
```

One-command release package:

```bash
npm run build:quick
```

## Output

The build writes extension files to `dist/`:

```text
dist/
  manifest.json
  content.js
  background/sw.js
  popup/popup.html
  popup/popup.js
  icons/
  styles/
```

`npm run build:quick` also creates a timestamped `FoxiFill-extension-*.zip` package for manual distribution or Chrome Web Store submission.

## Browser Loading

Chrome or Edge:

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the `dist` directory.

Firefox temporary loading:

1. Open `about:debugging`.
2. Select This Firefox.
3. Select Load Temporary Add-on.
4. Choose `dist/manifest.json`.

## Troubleshooting

If a build fails, reinstall dependencies and retry:

```bash
rm -rf node_modules dist
npm ci
npm run build:prod
```

If the extension does not load, verify that `dist/manifest.json`, `dist/content.js`, `dist/background/sw.js`, and `dist/popup/popup.html` exist.

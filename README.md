# FoxiFill Extension

FoxiFill is an open-source browser extension that helps users capture web forms, prepare AI-ready prompts, review structured suggestions, and apply the result back to the original page.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chromewebstore.google.com/detail/foxifill/kcbgjmcocblfjphligafgmmabfddfiem)

## Features

- Capture visible form context from the current browser tab.
- Generate a structured prompt for an AI chat workflow.
- Support configurable AI destinations such as ChatGPT and DeepSeek.
- Preview field mappings before applying suggestions.
- Undo the most recent fill operation.
- Keep the core capture and fill workflow local to the browser extension.

## Install From Source

Requirements:

- Node.js 18 or newer
- npm
- Chrome or another Chromium-based browser

```bash
git clone https://github.com/FoxiFill/foxifill-extension.git
cd foxifill-extension
npm ci
npm run build
```

Load the built extension:

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the `dist` directory.

## Development

```bash
npm ci
npm run dev
npm run type-check
npm run lint
```

Production build:

```bash
npm run build:prod
```

Release package:

```bash
npm run build:quick
```

The generated `dist/` directory and release zip files are build artifacts and should not be committed.

## Project Structure

```text
src/
  background/   Extension service worker
  content/      Content scripts for form detection and filling
  libs/         Shared utilities, schemas, types, and storage helpers
  popup/        React popup UI
  styles/       Shared CSS
public/
  icons/        Extension icons
  models/       AI destination logos
scripts/        Build and asset helper scripts
```

## Permissions

FoxiFill requests permissions required for the extension workflow:

- `activeTab`: capture context from the active tab after user action.
- `storage`: store workflow state, settings, form snapshots, and undo data.
- `clipboardWrite`: prepare AI prompts and supporting content for user-controlled paste flows.
- `scripting`: interact with page forms through content scripts.
- `tabs`: manage the capture-to-AI workflow across browser tabs.
- `contextMenus`: expose quick actions from the page context menu.
- `<all_urls>` host permission: allow form capture and fill workflows across user-selected websites.

Any permission change should be documented in the pull request.

## Privacy

FoxiFill is designed around user-controlled capture, review, and apply steps. The extension does not require a FoxiFill server to process captured form data. Users decide what content to send to their selected AI destination.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

FoxiFill Extension is released under the [MIT License](LICENSE).

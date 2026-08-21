# FoxiFill Extension

<p align="center">
  <img src="public/logo.svg" alt="FoxiFill" width="104" height="104">
</p>

<p align="center">
  A local-first AI form filler for reviewable browser workflows.
</p>

<p align="center">
  <a href="https://github.com/FoxiFill/foxifill-extension/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/FoxiFill/foxifill-extension/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://chromewebstore.google.com/detail/foxifill/kcbgjmcocblfjphligafgmmabfddfiem"><img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome_Web_Store-install-F67B26"></a>
</p>

FoxiFill helps you capture form context, prepare an AI-ready prompt, review structured suggestions, and apply approved values back to the original page. The core capture, matching, review, fill, and undo workflow runs in the browser; you decide what to send to an AI chat and what to apply.

## Why FoxiFill

- **Review before fill:** inspect mappings and disable anything that should not be applied.
- **Local-first control:** no FoxiFill server is required for the core workflow.
- **Works with real browser forms:** supports text fields, text areas, selects, checkboxes, and radio buttons.
- **Recoverable changes:** undo the most recent fill operation.
- **Open source:** inspect the extension, report issues, and contribute under the MIT license.

## Install

The easiest option is the [Chrome Web Store listing](https://chromewebstore.google.com/detail/foxifill/kcbgjmcocblfjphligafgmmabfddfiem).

To install from source:

```bash
git clone https://github.com/FoxiFill/foxifill-extension.git
cd foxifill-extension
npm ci
npm run check
npm run build:prod
npm run verify:build
```

Then open `chrome://extensions/`, enable Developer mode, select **Load unpacked**, and choose the generated `dist` directory.

## How it works

1. Open a page containing a form and choose **Capture Form**.
2. Open your selected AI chat with the prepared prompt.
3. Copy the completed structured response back to FoxiFill.
4. Review the proposed field mappings.
5. Apply the enabled values, or undo the latest fill if needed.

FoxiFill fills fields but does not submit the form for you.

## Development

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer
- Chrome or another Chromium-based browser

Commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the popup development server |
| `npm run type-check` | Check TypeScript without emitting files |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm test` | Run unit and DOM behavior tests |
| `npm run check` | Run the pre-commit type, lint, and test gate |
| `npm run build:prod` | Build the minified extension |
| `npm run verify:build` | Verify required Manifest V3 artifacts |
| `npm run audit:prod` | Audit production dependencies |

See [BUILD.md](BUILD.md) for packaging and browser-loading details.

## Project structure

```text
src/
  background/  Service worker and workflow coordination
  content/     Form capture, matching, fill, and undo behavior
  libs/        Shared parsers, schemas, storage, types, and messaging
  popup/       React popup interface and state
public/        Icons and bundled visual assets
scripts/       Build and artifact verification helpers
```

## Permissions and privacy

FoxiFill requests only the permissions needed for its user-initiated browser workflow:

- `activeTab` and `scripting` to inspect and fill the active page after user action.
- `storage` to keep settings and recoverable workflow state locally.
- `clipboardWrite` to prepare content for a user-controlled AI chat workflow.
- `tabs` to coordinate the original form and selected AI tab.
- `contextMenus` to expose quick actions.
- `<all_urls>` so the same workflow can work on user-selected form pages.

Permission changes require explicit pull-request documentation. Never include credentials, private form content, or personal data in issues, tests, screenshots, or logs. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use [GitHub Issues](https://github.com/FoxiFill/foxifill-extension/issues) for reproducible bugs and focused feature requests. Security reports must follow [SECURITY.md](SECURITY.md), not public issues.

## License

FoxiFill Extension is available under the [MIT License](LICENSE).

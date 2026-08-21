# Contributing to FoxiFill Extension

Thank you for improving FoxiFill. Contributions should be focused, reviewable, tested, and safe for users who run the extension on real forms.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use a bug report for reproducible defects and a feature request for product proposals.
- Discuss changes to permissions, data handling, workflow architecture, or public behavior before implementation.
- Never post secrets, credentials, personal data, or private form content.

## Local setup

```bash
git clone https://github.com/FoxiFill/foxifill-extension.git
cd foxifill-extension
npm ci
npm run check
npm run build:prod
npm run verify:build
```

Use Node.js 20.19 or newer. Load `dist` from `chrome://extensions/` for manual workflow testing.

## Branches and commits

Create a focused branch from `main`. Keep commits small enough to review independently and use:

```text
type(scope): short title
```

Allowed types:

- `feature`: user-facing capability
- `bugfix`: normal defect correction
- `hotfix`: urgent production correction
- `chore`: tests, documentation, dependencies, or tooling

Prefer scopes such as `popup`, `content`, `background`, `workflow`, `docs`, `deps`, or `ci`. Keep the first line under 50 characters.

Examples:

```text
feature(popup): add mapping preview
bugfix(content): escape field selectors
chore(test): cover ai response parsing
```

## Engineering standards

- Keep modules focused and reuse shared logic across popup, content, and background layers.
- Prefer typed boundaries and validation for external or persisted data.
- Add regression tests for bug fixes and behavior tests for new workflows.
- Preserve the user review step; do not make form submission automatic.
- Do not add remote executable code or silently expand data collection.
- Document every `src/manifest.json` permission or host-permission change.
- Keep user-facing copy about product value and behavior, not implementation internals.

## Required verification

Run before every pull request:

```bash
npm run check
npm run build:prod
npm run verify:build
npm run audit:prod
```

For behavior changes, also load the unpacked build and verify the smallest relevant end-to-end path. UI changes need a screenshot or recording; form-fill changes need the form shape and browser version used for verification.

## Pull requests

A pull request should include:

- The user problem and why the change is needed.
- A concise implementation summary.
- Automated and manual verification evidence.
- Screenshots or recordings for visible changes.
- Compatibility and privacy impact.
- Explicit permission changes, or a statement that permissions are unchanged.
- A linked issue when one exists.

Generated `dist` files, release archives, `node_modules`, local virtual environments, and editor metadata must not be committed.

Maintainers may request a smaller scope, additional tests, or a security review before merge. All participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

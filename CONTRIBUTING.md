# Contributing

Thank you for helping improve FoxiFill Extension.

## Development Flow

1. Fork the repository.
2. Create a feature branch.
3. Install dependencies with `npm ci`.
4. Make focused changes with clear tests or verification notes.
5. Run quality checks before opening a pull request.

```bash
npm run type-check
npm run lint
npm run build:prod
```

## Pull Request Expectations

- Explain what changed and why.
- Include manual verification steps.
- Include screenshots or screen recordings for UI changes.
- Document any permission change in `src/manifest.json`.
- Keep generated files, release zips, and local environment files out of the commit.

## Commit Messages

Use a short conventional format:

```text
type(scope): short title
```

Examples:

```text
feature(popup): add mapping preview
bugfix(content): fix select field fill
chore(ci): add build workflow
```

## Security

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).

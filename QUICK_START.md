# Quick Start

## Setup

```bash
npm ci
```

## Run Development Build

```bash
npm run dev
```

Load the generated extension from `dist/` in `chrome://extensions/`.

## Test The Workflow

1. Open a page that contains a form.
2. Click the FoxiFill extension action.
3. Capture the form.
4. Open the selected AI destination.
5. Review the structured AI response.
6. Apply the field mappings back to the original form.

## Quality Checks

```bash
npm run type-check
npm run lint
npm run build:prod
```

## Common Issues

If form capture does not find fields, wait until the page has fully loaded and retry.

If the AI response cannot be parsed, confirm that the response contains valid JSON in the expected FoxiFill response shape.

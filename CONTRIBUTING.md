# Contributing

Install Node.js 22+, run `npm ci --ignore-scripts`, then `npm test` and `npm run build`.
Use `npm run dev` for edits and the production preview for real model validation.

Keep the workflow short: recording → raw text → download. Do not add automatic
summaries, analytics or audio uploads. Avoid putting personal recordings, model
weights, credentials or local paths in commits. Use synthetic or appropriately
licensed samples when reporting recognition problems.

For a reproducible bug, include browser/device, file codec, language, chosen
mode and error text. Share audio only if you have permission. Tests should check
observable behavior or data correctness, not merely duplicate implementation.

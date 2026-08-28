# Baseline fixtures

- `legacy/v0-representative.json` is a valid pre-envelope diagram for v0-to-v1
  migration and round-trip checks.
- `golden/diagram-input.json` uses stable IDs, fractional/negative coordinates,
  XML-sensitive labels, Unicode, and an unknown block definition.
- `golden/diagram-export.svg` preserves the pre-redesign SVG for visual
  comparison. P01/P03 intentionally changed its text representation to theme
  tokens and local node coordinates while preserving bounds and rough seeds.
- `golden/diagram-export.sha256` is the exact current exported-SVG fingerprint
  used by the suite. It intentionally excludes selection, ports, guides,
  connection preview and presentation state.
- `contracts/multi-document-ui.ids.json` freezes the DOM IDs reserved for the
  future document selector, title input, and new-document action.

Treat these files as compatibility inputs/expected outputs. Update a golden
only after an intentional, reviewed format or rendering change.

# 031 — Settings UI redesign

Status: DONE

## Goal

Make Settings readable and predictable without changing the existing settings behavior or migrating away from Lit.

## Findings

- Shared form styles force labels and controls into horizontal rows.
- Controls have a fixed `200px` width even when their content is longer.
- Help text is sometimes a separate grid item, so it is visually detached from the setting it explains.
- Action buttons have no local styling and fall back to native white buttons.
- Screenshot image quality is shown under Audio Input.
- Long labels and shortcut rows do not have responsive wrapping rules.

## Work

- [x] Capture and inspect the current renderer UI.
- [x] Introduce a consistent page width and section hierarchy.
- [x] Make each setting a vertical, full-width field with attached help text.
- [x] Group related settings and move image quality to Screenshot Analysis.
- [x] Style secondary actions, checkboxes, shortcuts, and danger actions consistently.
- [x] Add responsive rules that prevent overlap and clipped text.
- [x] Run automated checks and capture the updated renderer UI.

## Acceptance criteria

- [x] No control relies on a fixed `200px` width.
- [x] Labels, controls, help text, and actions have a clear visual relationship.
- [x] Text wraps without overlapping adjacent elements.
- [x] The layout remains usable at narrow application widths.
- [x] Existing event handlers and persistence behavior remain unchanged.
- [x] Renderer screenshot confirms the intended layout.

## Checks

- `node --check src/components/views/CustomizeView.js` — passed.
- `node --check test/rendererRuntimeSmoke.js` — passed.
- All `test/*.test.js` files — passed.
- `git diff --check` — passed (line-ending warnings only).
- Renderer smoke at 700 px — passed; no overflowing elements and controls use the available width.
- Before/after renderer screenshots reviewed.

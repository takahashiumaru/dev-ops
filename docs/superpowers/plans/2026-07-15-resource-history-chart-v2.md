# Resource History Chart V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Resource History into a premium single-series analytics chart matching the supplied references.

**Architecture:** Keep the existing telemetry data source and SVG chart. Replace simultaneous series rendering with a selected metric state, then update the summary, area geometry, tooltip, chips, and responsive styles around that selected metric.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, SVG, CSS.

## Global Constraints

- Preserve metric history fallback, period filtering, and server APIs.
- Keep CPU, Memory, and Root Disk selectable.
- Keep a fixed 0–100% scale and safe empty/single-sample behavior.
- Do not add chart dependencies or modify unrelated dashboard panels.

---

### Task 1: Single-series chart behavior

**Files:**
- Modify: `src/components/dashboard-app.tsx:741-1010`

- [ ] Add `selectedMetric` state defaulting to `memory_percent`, derive selected series metadata, latest value, and summary label from `TELEMETRY_SERIES`.
- [ ] Change metric chips from visibility toggles to radio-like selection buttons with `aria-pressed` and one active state at all times.
- [ ] Render only the selected metric's gradient polygon, polyline, focus circle, and tooltip row.
- [ ] Keep pointer nearest-sample behavior; make keyboard arrows/Home/End/Escape work with the selected series and let Enter focus the latest sample.
- [ ] Add a large summary value and compact trend context above the plot without changing data calculations.
- [ ] Run `npm run typecheck` and commit with `feat: focus resource chart on selected metric`.

### Task 2: Reference-inspired visual polish

**Files:**
- Modify: `src/app/globals.css:778-910`
- Modify: `src/app/modern.css:1270-1390`

- [ ] Style the summary as a large, dark percentage with a muted label and small status badge.
- [ ] Restyle the selected metric chip as a quiet pill with a dark active state; make inactive chips white and low contrast.
- [ ] Make the selected area fill more subtle, the line thinner and rounder, grid dashed and faint, and the tooltip dark, compact, and centered around the active point.
- [ ] Add a translucent vertical hover band behind the selected point and keep tooltip clamped within chart bounds.
- [ ] Add responsive rules for stacked summary/chips and compact mobile spacing.
- [ ] Run `npm run typecheck`, `npm run build`, and `git diff --check`.
- [ ] Commit with `style: polish resource chart analytics presentation`.

### Task 3: Runtime verification

**Files:**
- No new files.

- [ ] Start the app locally and verify the chart renders with the current dashboard data path.
- [ ] Verify Memory, CPU, and Root Disk selection, period controls, hover tooltip, keyboard inspection, and mobile wrapping.
- [ ] Confirm zero/one/many samples do not produce invalid SVG geometry or console errors.
- [ ] Run the final typecheck and production build; record that the repository has no `npm test` script if applicable.

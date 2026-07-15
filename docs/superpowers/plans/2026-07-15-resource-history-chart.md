# Resource History Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern, accessible area chart for CPU, memory, and root-disk history that matches the approved light observability reference.

**Architecture:** Keep telemetry fetching and period filtering unchanged. Refine the existing `TelemetryChart` React/SVG component with local series-visibility and keyboard-inspection state, then add isolated presentation rules in the current dashboard stylesheets.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, custom SVG, CSS.

## Global Constraints

- Use the existing custom React/SVG implementation; add no chart dependency.
- Keep the vertical scale fixed at 0–100%.
- Preserve APIs, telemetry persistence, filtering behavior, and unrelated dashboard panels.
- Support zero, one, and many samples.
- Provide focus-visible keyboard inspection and reduced-motion-safe styling.

---

### Task 1: Interactive SVG area chart

**Files:**
- Modify: `src/components/dashboard-app.tsx:723-867`

**Interfaces:**
- Consumes: `history: DashboardData["metricHistory"]` and `live: LiveData | null`.
- Produces: the existing `TelemetryChart` component with local `visibleSeries: Record<MetricKey, boolean>` and `hovered: number | null` state; no public API changes.

- [ ] **Step 1: Record the pre-change verification baseline**

Run: `npm run typecheck`

Expected: exit code 0. Any existing failure must be recorded before editing and must not be attributed to the chart redesign.

- [ ] **Step 2: Define typed series metadata and SVG geometry helpers**

Add a `MetricKey` union and a `SERIES` array next to `TelemetryChart`:

```tsx
type MetricKey = "cpu_percent" | "memory_percent" | "disk_percent";

const TELEMETRY_SERIES: Array<{
  key: MetricKey;
  label: string;
  shortLabel: string;
  className: "cpu" | "memory" | "disk";
}> = [
  { key: "cpu_percent", label: "CPU", shortLabel: "CPU", className: "cpu" },
  { key: "memory_percent", label: "Memory", shortLabel: "MEM", className: "memory" },
  { key: "disk_percent", label: "Root disk", shortLabel: "DISK", className: "disk" },
];
```

Create `linePoints(key)` and `areaPoints(key)` from the current `pointX`/`pointY` helpers. `areaPoints` must close at `height - bottom` and must return valid coordinates for a one-sample series.

- [ ] **Step 3: Add accessible legend toggles and latest values**

Initialize every metric as visible. Render the legend items as buttons with `aria-pressed`, metric names, and latest values. The toggle handler must refuse to hide the last visible series:

```tsx
function toggleSeries(key: MetricKey) {
  setVisibleSeries((current) => {
    if (current[key] && Object.values(current).filter(Boolean).length === 1) return current;
    return { ...current, [key]: !current[key] };
  });
}
```

- [ ] **Step 4: Render clipped gradient areas and rounded lines**

Add SVG `<defs>` with one vertical gradient per series plus a plot clip path. Use `useId()` to derive collision-free identifier prefixes. For each visible metric, render:

```tsx
<polygon className={`telemetry-area ${series.className}`} points={areaPoints(series.key)} />
<polyline className={`telemetry-line ${series.className}`} points={linePoints(series.key)} />
```

Apply the clip path to both elements. Preserve exact sample points; rounded line caps and joins are presentation only.

- [ ] **Step 5: Implement pointer and keyboard inspection**

Keep nearest-sample pointer selection, including a single sample. Make the SVG focusable with `tabIndex={0}` and handle `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Escape`, and `Enter`. Render one focus circle per visible series, a vertical guide, and all visible metric rows in the tooltip. Clamp the tooltip's horizontal percentage so it stays within the chart.

- [ ] **Step 6: Run the type checker**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 7: Commit the component behavior**

```bash
git add src/components/dashboard-app.tsx
git commit -m "feat: add interactive resource area chart"
```

### Task 2: Modern chart presentation and responsive polish

**Files:**
- Modify: `src/app/globals.css:778-885`
- Modify: `src/app/modern.css:1260-1340`

**Interfaces:**
- Consumes: `.chart-series-toggle`, `.telemetry-area`, `.telemetry-line`, `.telemetry-focus`, `.telemetry-crosshair`, and `.telemetry-tooltip` markup from Task 1.
- Produces: light observability styling consistent with existing dashboard tokens.

- [ ] **Step 1: Replace passive legend styling with metric chips**

Style `.chart-series-toggle` as a 40-pixel minimum-height borderless button with a colored marker, label, current value, hover state, `aria-pressed="false"` muted state, and a visible `:focus-visible` outline. Allow `.chart-legend` to wrap on smaller widths while keeping `.sample-count` aligned to the far edge where space permits.

- [ ] **Step 2: Apply reference-inspired plot styling**

Use subtle horizontal grid lines, rounded 2–2.5px strokes, translucent gradient fills, a dashed blue-gray crosshair, and outlined focus points. Remove the old hard-edged line joins and square tooltip shadow. The tooltip should use a rounded white surface, restrained shadow, timestamp divider, and aligned value rows.

- [ ] **Step 3: Restyle period controls as pills**

Keep all existing buttons and click handlers. Give inactive controls white/transparent backgrounds with subtle borders, and the active control a dark background with white text. Preserve visible keyboard focus and a minimum practical touch height.

- [ ] **Step 4: Add responsive rules**

At the dashboard's existing narrow breakpoint, reduce chart padding, allow period controls and legend items to wrap, keep tooltip width within the viewport, and preserve the SVG view box. No text label may overlap another label at the four rendered timestamp positions.

- [ ] **Step 5: Verify CSS and production compilation**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0; the build reports successful route compilation.

- [ ] **Step 6: Perform runtime visual and interaction QA**

Start the app with `npm run dev` and inspect the dashboard at desktop and mobile widths. Confirm:

- the reference-like translucent areas and rounded lines render;
- every period button remains functional;
- legend toggles hide/show series while retaining at least one;
- pointer and keyboard inspection show correct timestamp/value rows;
- tooltip stays within both chart edges;
- a single-sample fallback remains visible;
- no console error appears.

- [ ] **Step 7: Commit presentation changes**

```bash
git add src/app/globals.css src/app/modern.css
git commit -m "style: modernize resource history chart"
```

### Task 3: Final verification and documentation sync

**Files:**
- Modify only if implementation behavior differs: `docs/superpowers/specs/2026-07-15-resource-history-chart-design.md`

**Interfaces:**
- Consumes: completed chart component and styles.
- Produces: a verified implementation matching the approved design.

- [ ] **Step 1: Review the implementation against every design requirement**

Compare the code and rendered behavior with the design sections for plot, hover inspection, responsive behavior, empty/single-sample states, accessibility, and implementation boundaries. Correct any mismatch in its owning file.

- [ ] **Step 2: Run final repository checks**

Run:

```bash
git diff --check
npm run typecheck
npm run build
git status --short
```

Expected: no whitespace errors; typecheck and build exit 0; status contains only the intended implementation changes, if any remain uncommitted.

- [ ] **Step 3: Commit any final corrections**

If Task 3 required changes:

```bash
git add src/components/dashboard-app.tsx src/app/globals.css src/app/modern.css docs/superpowers/specs/2026-07-15-resource-history-chart-design.md
git commit -m "fix: finish resource chart verification"
```

If no files changed, do not create an empty commit.

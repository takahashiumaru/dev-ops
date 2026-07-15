# Resource History Chart V2 — Analytics Visual Refresh

## Goal

Make the Resource History card feel like a modern analytics dashboard: spacious, calm, readable, and visually close to the supplied reference images while preserving all three server metrics and the existing period controls.

## Visual Direction

The chart uses a single focused metric at a time. Memory is the default primary series because it is the most stable high-signal resource trend; CPU and Root Disk remain one-click selectable through compact metric chips. This removes the heavy three-line collision that made the previous version feel rough.

The card follows the reference language: large current value, small trend context, pill-shaped period selector, pale gradient area, thin smooth line, light dashed grid, and a dark compact hover tooltip with a dotted vertical guide.

## Component Behavior

- Add a `selectedMetric` local state defaulting to `memory_percent`.
- Metric chips switch the primary series and update the summary value, label, color, and tooltip value.
- Keep the existing sample count and period filtering unchanged.
- Keep the 0–100% scale for honest resource comparison.
- Render one area fill and one line at a time; hidden metrics are not drawn.
- Hover and keyboard inspection continue to select the nearest sample, showing one focus point and one value.
- Keyboard users can switch metric chips and inspect samples without pointer input.
- Empty and single-sample states remain safe and legible.

## Styling

- Use a restrained white surface, 18–24px internal spacing, and a soft 16–20px radius.
- Use a pale cyan/indigo/orange gradient derived from the selected metric color, fading to transparent before the baseline.
- Use a 2px rounded line with a subtle glow only at the active point.
- Use low-contrast dashed horizontal grid lines and compact axis labels.
- Use a black/navy tooltip with white value text, rounded corners, and a subtle shadow.
- Keep active period and metric chips as minimal pills with a dark active state.
- Preserve visible keyboard focus and reduced-motion behavior.

## Scope and Verification

Only the `TelemetryChart` component and its directly related styles change. No telemetry API, database, or unrelated dashboard card changes. Verify typecheck, production build, desktop/mobile layout, metric switching, tooltip positioning, keyboard inspection, and zero/one/many sample rendering.

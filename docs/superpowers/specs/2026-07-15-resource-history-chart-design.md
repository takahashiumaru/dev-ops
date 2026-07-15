# Resource History Chart Redesign

## Goal

Improve the Resource History panel so CPU, memory, and root-disk trends are visually clear, modern, and easy to inspect while preserving the existing telemetry data and dashboard behavior.

## Visual Direction

Use a light observability-style area chart inspired by the approved reference. The panel remains consistent with the existing dashboard, but gains a softer visual hierarchy, rounded controls, subtle gradients, and a focused hover interaction.

The distinctive element is a shared inspection cursor: hovering anywhere over the plot reveals one vertical guide, three color-coded points, and a compact tooltip containing the timestamp and all metric values.

## Color and Typography

- Panel: existing dashboard white panel token.
- Grid: low-contrast cool gray using existing border tokens.
- CPU: warm orange, derived from the existing orange token.
- Memory: cyan-blue, derived from the existing cyan token.
- Root disk: indigo-purple, derived from the existing purple token.
- Area fills: transparent vertical gradients using each series color, strongest near the line and fading to zero at the baseline.
- Type: retain the existing dashboard font system; use the condensed/utility face for chart metadata and values.

## Component Design

### Header and period controls

Retain the Resource History title and existing period choices. Restyle the period switch as quiet outlined pills with a dark active state, matching the approved reference. Do not change the meaning or data filtering behavior of any period option.

### Legend and current values

Replace the passive legend labels with accessible buttons. Each button displays a colored marker, metric name, and latest percentage. Clicking a metric toggles its visibility without modifying the underlying data. At least one series must remain visible so the chart cannot be left empty accidentally.

The stored-sample count remains visible as secondary metadata.

### Plot

- Keep the chart scale fixed from 0% to 100% for honest comparisons.
- Use horizontal grid lines at 0%, 25%, 50%, 75%, and 100%.
- Show a small, responsive set of timestamp labels to prevent overlap.
- Draw each visible series as an area gradient plus a smooth-looking line with rounded joins and caps. The geometry must continue to pass through the real sample points; no interpolation may invent values beyond the dataset.
- Clip fills and lines to the plot area.
- Use unique SVG gradient and clip identifiers so multiple chart instances cannot conflict.

### Hover inspection

Pointer movement selects the nearest stored sample. The active state contains:

- a subtle dashed vertical guide;
- one outlined point for each visible series;
- a floating tooltip with the full localized timestamp;
- CPU, memory, and root-disk values, color coded to their lines.

The tooltip is positioned to remain inside the chart on both left and right edges. Pointer leave clears the inspection state. Keyboard users can focus the plot and inspect samples with the left and right arrow keys.

### Responsive behavior

On narrower screens, controls may wrap, labels become more compact, and tooltip spacing reduces. The SVG remains fluid-width with a stable view box. Touch targets remain at least 40 pixels high where practical.

## Data Flow

The chart continues to consume `metricHistory`, with the existing live metric fallback when no history exists. Filtering by period remains owned by the current dashboard page. Series visibility and hover selection are local UI state only and never alter server data.

## Empty and Single-Sample States

- No samples: preserve the dashboard's existing empty-state handling.
- One sample: center the sample horizontally, render visible points, and allow the tooltip to show that sample without division-by-zero or invalid path geometry.
- Missing or out-of-range values: normalize to the existing 0–100 display range.

## Accessibility

- Keep an explicit chart label for assistive technology.
- Legend toggles expose pressed state and descriptive labels.
- Do not rely on color alone: labels and tooltip rows name every metric.
- Provide visible keyboard focus.
- Respect reduced-motion preferences; no continuous or decorative animation is required.

## Implementation Boundaries

- Use the existing custom React/SVG implementation; add no chart dependency.
- Limit code changes to the telemetry chart and the styles directly supporting it.
- Preserve APIs, metric collection, persistence, and unrelated dashboard panels.

## Verification

- Run TypeScript type checking and the production build.
- Verify the chart with zero, one, and many samples.
- Confirm hover, keyboard inspection, legend toggles, and every period control.
- Inspect desktop and mobile layouts for clipped tooltips, overlapping labels, and adequate contrast.

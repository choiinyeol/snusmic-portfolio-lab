# Chart Rules

- Use `lightweight-charts` for market price, equity curve, and financial time-series charts.
- Keep chart components isolated behind Client Component boundaries.
- Data loading and transformation should happen outside visual leaf components.
- Use muted grid lines, clear legends, and tabular tooltips.
- Avoid over-coloring. A few meaningful series colors are better than many loud ones.
- Every chart needs an empty state when there are no points.
- Prefer showing the actual financial path over decorative chart mockups.
- For public screens, label benchmark lines as benchmarks, not strategies.
- Tooltip position should not fight the cursor. Prefer fixed or offset tooltips that keep the hovered path visible.
- Many-line charts should emphasize the selected or important series and mute the rest.
- Statistics charts need a title, a short takeaway, and a visible sample definition.

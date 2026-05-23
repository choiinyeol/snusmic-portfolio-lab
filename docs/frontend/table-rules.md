# Table Rules

- Use TanStack Table for complex sorting, filtering, column visibility, and export flows.
- Right-align numeric financial cells.
- Use `font-mono` or `tabular-nums` for numbers.
- Keep row height compact, but preserve touch targets on mobile.
- Use badges for categorical status only when they speed scanning.
- Avoid coloring every number. Reserve color for signed returns, danger, warning, and important status.
- CSV/export actions should be present only when useful.
- Empty states should state what data is missing and where the user can go next.
- Column headers should sort when sorting is useful; use compact sort indicators.
- Do not dedicate a column to "detail view" when the row itself can navigate to the detail page.
- Keep symbol/company display compact: Korean rows should prioritize company name; U.S. rows can prioritize ticker.
- Hide exchange suffixes and venue labels from dense table rows unless they affect a decision.

# UI Review Rubric

Score each frontend change from 1 to 5.

## 1. Information Hierarchy

5 = User immediately knows what matters.  
3 = Main content is visible, but priority is unclear.  
1 = Everything has similar weight.

Check title usefulness, key metric visibility, primary actions, and whether secondary metadata is visually quiet.

## 2. Density

5 = Dense enough for professional use while readable.  
3 = Some sections are too loose or cramped.  
1 = Generic landing page or toy dashboard.

Desktop density matters more than decorative spaciousness.

## 3. Alignment

5 = Edges, labels, values, and controls align cleanly.  
3 = Minor inconsistency.  
1 = Ragged layout.

Numbers should align predictably and use tabular formatting.

## 4. Component Consistency

5 = Reuses existing components and tokens.  
3 = Some one-off styling.  
1 = New random visual language.

Use local shadcn-style primitives and existing chart/table wrappers first.

## 5. Interaction Quality

5 = Empty, error, hover, focus, and partial data states are handled.  
3 = Happy path works.  
1 = State handling is missing.

## 6. Responsiveness

5 = Desktop and mobile are intentionally designed.  
3 = Mobile works but feels accidental.  
1 = Breaks on small screens.

## 7. Financial UI Correctness

5 = Dates, returns, PnL, risk, and prices are formatted consistently.  
3 = Mostly readable, with minor precision or alignment issues.  
1 = Financial data is visually confusing.

Any score below 4 should be patched before finalizing unless the tradeoff is explicitly accepted.

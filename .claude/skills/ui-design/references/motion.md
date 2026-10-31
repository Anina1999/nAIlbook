# ui-design: motion

Part of the `ui-design` skill ([SKILL.md](../SKILL.md)).

## Motion

- Motion only answers an action: a dialog opens, a slot is selected, a confirmation appears, the carousel moves. Use `transition-colors` or `transition-opacity` for 150–200ms; the manicurist card's lift moves `transform` for 250ms. Never animate width or height (the active dot changes its width without a transition).
- **At most three infinite animations, all of them decoration:** the glitter's twinkle, the stars' twinkle and the light running round the active card's border (`@property --spin`). Everything else is shown in its static best frame, never removed: the aurora (still, because moving it puts its bright spot under text, 2.1–2.5:1), the silver sheen, the iridescent sheen, the milky way's dust (opacity 0.55) and the active card's breathing (it stays lifted by 4px).
- No entrance animations when a page loads, and no lift or zoom on hover, except the manicurist card (*Components*), which lifts by 4px.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no animation and no transition at all, and no hover lift. In CSS every animation and transition sits under `@media (prefers-reduced-motion: no-preference)` or `motion-safe:`. Code that moves things reads `useReducedMotion()`: the carousel gets `speed: 0`, a scroll uses `behavior: 'auto'`.

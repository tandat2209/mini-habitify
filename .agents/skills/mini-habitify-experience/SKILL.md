---
name: mini-habitify-experience
description: Design and build mini-habitify dashboards, check-ins, data visualizations, and theme/layout customization. Use for mini-habitify user-facing interface work.
---

# mini-habitify experience

Read design/customization requirements in `docs/product-brief.md` and existing UI/token conventions. Build an original, calm, expressive consumer experience under the mini-habitify name and tagline. Use available frontend design skills when useful; do not copy reference brands.

Customization must change the experience beyond colors. Design developer-oriented presentations (such as dense commit-style activity graphs) and playful, approachable presentations (such as larger check-in controls and simpler visual progress). The exact playful metaphor is open; do not assume gamification, rewards, or a separate child account system. Let users select their preferred style without inferring age or profession.

Keep presentation variants above the shared tracker engine and authenticated data layer. Reuse calculated progress and mutation contracts; vary visualizations, typography, density, shapes, and interaction presentation. Compose existing themes/layouts where suitable and avoid copying domain logic into each style. A Git-style graph represents local tracker activity; GitHub integration remains deferred.

Today should connect greeting/date, completion summary, tracker cards, quick actions, recent activity, and helpful empty states. Optimize common check-ins for few actions while retaining clear success, pending, and error feedback. Make retry/rollback behavior match actual mutation semantics; do not display a saved state after a failed write.

Use centralized semantic CSS tokens for surfaces, text, borders, accents, focus, and chart colors. Paper uses warm cream/muted brown/editorial typography; Pastel uses lavender/peach/mint; Terminal uses dark surfaces/green/developer typography; Brutalist uses bold type/high contrast/expressive color. Themes should change visual atmosphere while preserving accessible controls. Support Standard and Compact layouts with the same behavior.

Separate theme preview from saved preferences. Persist selected theme, layout, and basic widgets through authenticated data access; restore on subsequent sessions. Switching appearance must never mutate tracking data. Avoid arbitrary drag-and-drop layout building for the MVP.

Progress ring, calendar, heatmap, history, and dashboard must consume actual logs and shared tracker-engine results. Use the documented user timezone for dates. Provide readable text equivalents and labels for chart meaning and status; do not rely on color alone.

Verify that developer-oriented and playful presentations differ beyond palette, display consistent progress from the same logs, support check-ins, and preserve history and preferences when switched.

Check mobile tracker creation/check-in, desktop layout, keyboard order, visible focus, form labels/errors, theme contrast, and reduced-motion behavior. Include loading/error/empty states. Use browser verification when tooling is available and report any unverified interactions.

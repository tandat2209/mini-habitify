---
name: mini-habitify-delivery
description: Plan and deliver incremental mini-habitify app features with file-level scope, real persistence, and acceptance evidence. Use for mini-habitify implementation and release preparation.
---

# mini-habitify delivery

Read root `AGENTS.md`, `docs/product-brief.md`, and `docs/implementation-roadmap.md`. Inspect existing implementation and package scripts before planning. The roadmap contains proposed paths, not a mandate to create empty folders.

For a feature, identify the smallest complete user flow, edit targets, needed domain decisions, and observable acceptance criteria. Implement across domain, server/data, and UI boundaries as needed; do not stop at disconnected screens. Start initial implementation with authenticated habit creation, check-in, progress, and persistence after refresh.

Keep the app a feature-oriented modular monolith. Prefer server rendering/data loading where suitable; use client components for actual interaction. Avoid introducing global state or infrastructure without a concrete need.

Read `mini-habitify-tracker-engine` for calculations, `mini-habitify-supabase-security` for auth/data changes, and `mini-habitify-experience` for user-facing work. Record material decisions in `docs/decisions.md`.

Verify the slice using available type/lint/build scripts, meaningful domain tests, and critical real persistence flows. If services or credentials are unavailable, complete independent work and report the unverified acceptance criteria precisely. Fake data does not satisfy production flows.

Update roadmap status only with evidence. Handoff should state changed behavior, verification results, and remaining limits. Release preparation does not itself authorize deployment.

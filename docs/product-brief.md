# mini-habitify product brief

Act as a senior full-stack engineer, product designer, and SaaS architect. Build a polished, production-minded MVP for mini-habitify, a personal tracking web application inspired by Habitify, with a strong focus on customization, lifestyle tracking, and beautiful user experiences.

1. Product vision

mini-habitify helps users track anything that matters in their daily lives:

- Habits and routines
- Exercise, health, and wellness
- Reading and learning
- Time spent on activities
- Numeric measurements and counters
- Productivity and GitHub commit activity in future versions

The key differentiator is that users can personalize the entire tracking experience with multiple themes, layouts, visualizations, and dashboard widgets.

Customization is a core product requirement. Different people should be able to experience the same tracker through meaningfully different visual styles and interactions. A developer might prefer a dense Git commit-style activity graph; a child might prefer playful imagery, larger controls, and a simpler progress display. These examples guide design exploration; the exact child-friendly visual metaphor is not yet chosen.

Support presentation choices beyond color palettes: typography, density, shapes, visualizations, and check-in presentation. Keep the shared tracker engine, goal semantics, log history, and persistence consistent across styles. Let users choose their preferred experience rather than assigning it based on inferred age or occupation. A commit-style graph visualizes mini-habitify activity and does not require GitHub integration.

The MVP customization acceptance criteria must include a developer-oriented presentation and a playful, approachable presentation that differ beyond colors. Verify that the same logs produce consistent progress in both, check-ins work in both, and changing styles preserves data and saved preferences. The existing four themes and two layouts remain required; these experiences may compose them rather than adding a separate app or tracker model.

Brand tagline: “Make your everyday yours.”

Do not copy Habitify's exact UI, branding, or assets. Use it only as product inspiration.

2. Tech stack

Use the following stack unless the existing repository already has a sensible equivalent:

- Next.js App Router
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui
- Supabase Auth and PostgreSQL
- Zod for validation
- React Hook Form for forms
- Recharts for charts
- Lucide icons
- Vitest for unit tests
- Playwright for critical end-to-end tests
- Vercel deployment

Prefer a simple modular monolith. Avoid unnecessary microservices, complex state management, and premature abstractions.

3. Core features

Authentication

- Sign up, login, logout
- Protected application routes
- Persistent authenticated sessions
- Secure user-specific data access

Universal tracker engine

Support four tracker types:

1. Habit: completed or not completed
2. Counter: sum of numeric entries
3. Duration: track time in seconds or minutes
4. Numeric: record measurements such as weight, pages read, or mood scores

Each tracker should support:

- Name and optional description
- Icon and accent color
- Optional target and unit
- Daily, weekly, or monthly goal period
- Schedule by weekday
- Multiple logs per day when appropriate
- Edit and archive functionality
- Historical activity and progress

Keep tracking calculations in reusable, testable TypeScript functions rather than duplicating logic across UI components.

Dashboard

Create a polished Today dashboard with:

- Greeting and current date
- Daily completion summary
- Progress indicators
- Tracker cards
- Quick check-in actions
- Recent activity
- Empty states for new users

Users should be able to track an activity with as few clicks as possible.

Customization

Create at least four visually distinct themes:

- Paper: warm cream, muted brown, editorial typography
- Pastel: soft lavender, peach, and mint
- Terminal: dark background, green accents, developer aesthetic
- Brutalist: bold typography, high contrast, expressive colors

Support at least two dashboard layouts:

- Standard
- Compact

Implement themes using centralized CSS variables/design tokens, not hardcoded colors scattered throughout components.

Allow users to:

- Preview and switch themes
- Choose a dashboard layout
- Configure basic dashboard widgets
- Persist preferences to Supabase
- Restore preferences after logging in again

Theme selection must never modify tracking data.

Visualizations

Implement:

- Progress ring
- Calendar view
- Activity heatmap
- Tracker history

Visualizations must use actual database data and share the same tracker calculation logic.

4. Design direction

Create a premium consumer web app that feels calm, personal, modern, and expressive.

Visual references:

- The clarity of Linear
- The flexibility of Notion
- The approachability of modern wellness applications
- The visual customization of personal dashboards

Do not make every screen look identical. Themes should meaningfully change the visual atmosphere while maintaining usability and accessibility.

Use:

- Responsive layouts
- Generous spacing
- Clear typography hierarchy
- Subtle borders and shadows
- Carefully designed empty states
- Smooth but restrained transitions
- Accessible controls and keyboard navigation

The desktop experience should be excellent, while mobile users must still be able to create trackers and check in comfortably.

5. Database and security

Create version-controlled Supabase migrations for:

- profiles
- trackers
- tracker_logs
- themes
- user_preferences
- dashboard_widgets

Requirements:

- Use UUID primary keys where appropriate.
- Add indexes for user, tracker, and date queries.
- Enable Row Level Security on user-owned tables.
- Ensure users can only access their own data.
- Validate every mutation on the server.
- Never expose service-role credentials to the browser.
- Derive user identity from the authenticated session.
- Store timestamps consistently and define an explicit user-timezone policy for daily tracking.
- Archive trackers instead of immediately deleting their history.

Keep schema migrations reproducible from a fresh database.

6. Architecture

Organize the application by feature rather than putting all logic into large components.

Suggested structure:

src/
app/
components/
ui/
shell/
dashboard/
trackers/
visualizations/
appearance/
features/
tracker-engine/
trackers/
check-ins/
dashboard/
themes/
lib/
supabase/
validation/
auth/
styles/

Separate:

- UI components
- Domain models
- Business logic
- Data access
- Input validation
- API handlers

Avoid unnecessary duplication between the dashboard, tracker details, and visualizations.

7. Development priorities

Build the MVP in this order:

Phase 1 — Foundation

- Set up the project and environment
- Configure Supabase clients
- Implement authentication
- Create database migrations and RLS

Phase 2 — Core tracking

- Implement tracker CRUD
- Implement check-in and log management
- Build the tracker engine
- Write unit tests for progress calculations

Phase 3 — Main experience

- Build the Today dashboard
- Add tracker detail pages
- Implement calendar, progress ring, and heatmap

Phase 4 — Customization

- Implement four themes
- Add standard and compact layouts
- Persist preferences

Phase 5 — Release

- Test authorization and user isolation
- Add loading, error, and empty states
- Run critical Playwright flows
- Prepare production deployment

8. Out of scope for the initial MVP

Do not implement these unless the core product is already complete:

- GitHub integration
- MCP server
- AI-generated insights
- Social features
- Team collaboration
- Push notifications
- Theme marketplace
- Arbitrary drag-and-drop layout builder
- Background timers

Design the architecture so these features can be added later without rewriting the tracker engine.

9. Definition of done

The MVP is complete when a real user can:

1. Create an account and log in.
2. Create a habit tracker.
3. Check in and see progress update.
4. Create counter, duration, and numeric trackers.
5. View historical activity.
6. Change themes and dashboard layouts.
7. Refresh or log in again without losing data or preferences.
8. Use the application on desktop and mobile.
9. Access only their own data.

Critical flows must pass automated tests. There must be no known critical authorization vulnerabilities.

10. How to work

First inspect the existing repository and identify what is already implemented.

Then:

1. Produce a concise implementation plan and file-level task breakdown.
2. Identify assumptions and important schema decisions.
3. Implement the smallest complete vertical slice: authentication → create habit → check in → display progress → persist after refresh.
4. Verify the implementation with tests and type checking.
5. Continue with the remaining features incrementally.

Do not generate the entire application as one giant component. Do not leave core functionality as fake data or nonfunctional buttons. Do not claim a feature is complete unless it works.

If a decision is not specified, choose the simplest maintainable option and document the assumption.

Start by inspecting the repository and implementing the first working vertical slice.

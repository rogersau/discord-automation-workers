# Admin dashboard shell design

## Problem

The current admin UI is implemented as one large authenticated page that stacks gateway controls, stored server overview, blocklist editing, timed-role management, and ticket-panel configuration into a single long screen.

The requested change is to make the admin experience feel much closer to the shadcn dashboard example: a persistent dashboard shell, a clear landing page, and separate workspaces instead of one oversized operator page.

## Current context

- The authenticated admin UI currently lives primarily in `src/admin/App.tsx`.
- The project already uses React, Tailwind, and shadcn-style primitives under `src/admin/components/ui/`.
- The current admin behavior already supports:
  - gateway status polling and manual bootstrap
  - stored server overview data
  - server selection via the shared guild picker
  - blocklist editing
  - timed-role management
  - ticket-panel configuration and publishing
- Existing authenticated admin routes and runtime contracts already back these workflows; the main issue is information architecture, not missing operator capabilities.

## Scope

In scope:

- Replace the single large authenticated admin page with a persistent dashboard shell
- Introduce five authenticated dashboard views:
  - Overview
  - Gateway
  - Blocklist
  - Timed Roles
  - Tickets
- Make the Overview page feel like the shadcn dashboard example by emphasizing operational summary and quick actions
- Break the admin front end into smaller page-level and shared layout components
- Preserve current admin behavior and backend contracts wherever possible
- Update tests to cover the new shell and route/view split

Out of scope:

- Redesigning the login flow
- Replacing `guildId` as the internal identifier
- Reworking runtime storage, Discord API flows, or gateway control logic
- Adding analytics features that do not support actual admin operations
- Introducing nested sidebar navigation, themes, or preference storage

## Options considered

### 1. Functional five-page shell

Create a persistent sidebar layout with five focused pages: Overview, Gateway, Blocklist, Timed Roles, and Tickets. Keep the Overview page visually closest to the shadcn example, while letting workflow-heavy pages remain practical operator surfaces.

**Pros**

- Best match for the requested multi-page dashboard feel
- Gives each workflow room without forcing config tools into fake analytics UI
- Keeps the redesign concentrated in the admin front end
- Encourages smaller, easier-to-maintain React components

**Cons**

- Requires a moderate UI refactor because the current page is centralized in one component

### 2. Denser dashboard clone

Use the same five-page split but push all pages toward the denser shadcn example style, with more summary cards and tighter table-heavy composition.

**Pros**

- Visually closest to the example
- Produces a stronger “product dashboard” look

**Cons**

- More likely to make forms and configuration tasks feel cramped
- Higher risk of prioritizing style mimicry over admin usability

### 3. Server-centric workspace

Keep a sidebar and overview page, but make most of the admin experience revolve around selecting a server first and then swapping the rest of the screen into a per-server workspace.

**Pros**

- Strong fit for repeated work inside one server at a time
- Keeps related server tools close together

**Cons**

- Less aligned with the requested shadcn dashboard example
- Adds more navigation and state complexity than needed for the first redesign

## Selected approach

Use option 1: a functional five-page shell.

This best fits the request for a shadcn-style dashboard without compromising the operator workflows that already exist. The UI gets a clear dashboard home and distinct workspaces, while the underlying admin behavior stays stable.

## Design

### Dashboard shell

The authenticated admin experience should move into a reusable dashboard shell with:

- a persistent left sidebar
- a simple page header region
- constrained content width similar to the shadcn dashboard example
- sign-out anchored separately from the main navigation

The login screen remains outside this shell.

The sidebar should stay flat and simple in the first pass:

- Overview
- Gateway
- Blocklist
- Timed Roles
- Tickets

No nested navigation is needed for the initial redesign.

### Page responsibilities

#### Overview

The Overview page is the main landing page and should feel most like the shadcn example.

It should emphasize operational summary and quick actions:

- KPI cards for gateway state, stored server count, and timed-role count
- a gateway summary panel
- quick actions such as starting the gateway and refreshing admin data
- a compact “stored server data” section that highlights current coverage without turning into a giant editor surface

The goal is to let an operator understand system state quickly before drilling into a specific workflow page.

#### Gateway

The Gateway page should isolate live session telemetry and gateway controls from the rest of the admin tools.

This page keeps the current runtime behavior but gives it a dedicated view for:

- current state badge and messaging
- start/refresh controls
- session details such as session ID, sequence, heartbeat interval, resume URL, backoff state, and last error

#### Blocklist

The Blocklist page should become a focused workflow:

- select a server
- load the current blocklist state
- add or remove blocked emoji
- view the resulting blocked emoji list

This page should no longer compete visually with gateway or ticket tooling.

#### Timed Roles

The Timed Roles page should prioritize current assignments first and mutation controls second.

It should provide:

- server selection
- current assignment visibility
- add/remove controls
- success and error messaging near the controls that trigger them

#### Tickets

The Tickets page should own ticket-panel configuration and publishing.

It should include:

- server selection and resource loading
- ticket-panel settings
- ticket-type configuration
- save and publish actions

This keeps the largest editor in its own workspace instead of burying it at the bottom of a multipurpose page.

### Front-end structure

The redesign should break the current `App.tsx` into smaller pieces with clear boundaries:

- an authenticated dashboard shell/layout component
- route or view components for each of the five pages
- shared display components for summary cards, page headers, and status panels
- existing reusable workflow components kept where they already make sense

The goal is to prevent the new layout from collapsing back into one oversized component. Page-level composition should live in page components, while generic UI remains in shared primitives or narrowly scoped admin components.

### Data flow

The redesign should preserve existing admin behavior while making loading more page-oriented.

Expected flow:

1. Authentication gates access to the dashboard shell.
2. Overview loads summary data needed for cards and quick actions.
3. Gateway loads gateway telemetry and controls for the gateway page.
4. Blocklist, Timed Roles, and Tickets each load their own page-specific state when active rather than forcing the entire admin surface to initialize at once.
5. Existing admin APIs continue to accept and return their current payload shapes unless a small UI-supporting endpoint is clearly needed.

This keeps the refactor focused on UI structure and avoids unnecessary runtime churn.

### Error handling

Error handling should remain explicit and local to the page where the problem occurs:

- Overview errors render in the Overview page
- Gateway polling or mutation errors render in the Gateway page
- Server-directory failures continue to fall back to manual guild ID entry where the current UI already supports that pattern
- Workflow mutations keep surfacing success and failure near the relevant form

The redesign should not add silent fallbacks, hidden retries, or generic catch-all failure screens.

### Testing and verification

Update tests to cover:

- authenticated dashboard-shell rendering
- navigation or view switching between the five pages
- Overview rendering of summary cards and quick actions
- preservation of existing gateway, blocklist, timed-role, and ticket workflows after the page split
- any newly extracted page/layout components that change rendering expectations

Normal admin bundle rebuild and repository verification should remain part of implementation.

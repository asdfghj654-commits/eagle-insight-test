# Portal Access And Route Changes

Date: 2026-04-07

## Changes

- Restricted the dashboard "Portal Access" card to the `engineer` role only.
- Kept direct access to `/portal/data-research` protected by the existing engineer-only route guard.
- Replaced `/lead/reports` with a dedicated reports workspace for the technical crew.
- Fixed `/engineer/rules` so it opens the dashboard with the rules tab active instead of redirecting away from that context.
- Updated selected Hebrew UI references from `צי` to `טייסת`:
- Specialist navigation label
- Commander navigation label
- Login role descriptions
- Dashboard fleet tab label
- Added technician access to `/lead/reports` and exposed it in technician navigation.
- Added tailored graph controls, insight statistics, and a technical-vs-aircrew comparison panel.
- Added a visible professional-disclaimer banner in the main dashboard and reports workspace.
- Added per-signal min/max rule controls in the reports workspace with create/update/delete behavior.
- Wired "ניהול כללים" to the rules screen and broadened `/engineer/rules` access to specialist/engineer/commander.
- Replaced the blind "פתח תחקיר חדש" redirect with a draft form dialog before opening the engineering portal.

## Why `/lead/reports` looked broken

The route existed, but it rendered `Index.tsx`, so it behaved like another dashboard alias instead of a real reporting screen.

## Files Updated

- `src/pages/Index.tsx`
- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/ReportsPage.tsx`

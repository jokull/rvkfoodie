---
target: CRM flows
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-24T22-04-00Z
slug: src-routes-app-crm-tsx
---
# CRM Flows Critique — Reykjavík Foodie internal SPA (Operate surface)

Method: dual-agent (A: 35c1d123 · B: 99f9fb55). Targets: src/routes/app.crm.tsx, src/routes/app.crm_.$businessId.tsx, src/routes/app.tsx.

## Design Health Score: 16/40 — Poor

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Deal-stage update is fire-and-forget (void update.mutate) — zero feedback on the one consequential action |
| 2 | Match System / Real World | 2 | Raw pipeline slugs ("sample-sent") as labels; lowercase "+ add"/"cancel" vs "Add business" |
| 3 | User Control and Freedom | 1 | No edit, no delete, no undo anywhere; mistyped business name is permanent |
| 4 | Consistency and Standards | 2 | Same "add" in three vocabularies (dialog button, inline "Add", ghost "+ add" toggle); two h1s per page |
| 5 | Error Prevention | 1 | Empty contacts creatable; duplicate businesses possible; parseInt silently truncates; invisible roomCount regex failure |
| 6 | Recognition Rather Than Recall | 2 | List shows no pipeline/deal state; stage meanings must be recalled |
| 7 | Flexibility and Efficiency | 1 | Zero shortcuts, bulk actions, sort, or filter beyond name+industry |
| 8 | Aesthetic and Minimalist | 3 | Restrained and calm, but duplicate industry, "shown" count, 7-field rows add noise |
| 9 | Error Recovery | 1 | Raw "Failed: {error._tag}" everywhere; failed stage update leaves patched cache lying |
| 10 | Help and Documentation | 1 | No help, tooltips, or teaching empty states |

## Design Specificity Verdict
Category-interchangeable with a thin brand veneer: shadcnspace shell, generic three-card CRM (Hotels/Contacts/Deals). Product-authored: cream/blue tokens, kr/room ISK facts, the "sample-sent" pipeline stage. Deterministic scan: 0 findings on all CRM targets (regex engine; prose analyzers skip .tsx; HTML scans degraded — no htmlparser2/css-select — so contrast/selector checks are an undercount). Homepage findings were false positives (SSR <!-- --> counted as em-dashes). No browser visualization of authed pages (session-gated; auth not bypassed).

## Overall Impression
The architecture (entity-patch mutations, instant row appear) is doing the heavy lifting; the surface under-delivers on it — create-only, no feedback on the one consequential action (deal stage), flat slate-500 hierarchy, and a blank void on empty search.

## What's Working
1. Entity-patch mutations: adds patch the cached list in place — instant, no spinner.
2. "Add business" navigates straight into the new record — create pays off in one step.
3. Restrained Operate discipline: one accent, cream canvas, consistent kumo vocabulary, sensible Content/Sales IA.

## Priority Issues
1. [P0] Silent deal-stage updates — void update.mutate, no pending/error/rollback; cache shows a stage the server may have rejected. Fix: per-row loading, inline error, revert on failure, confirm on won/lost.
2. [P1] No edit or delete anywhere despite businesses.update/hotels.update/contacts.update existing. Mistyped data is permanent. Fix: row-level edit + delete with confirmation.
3. [P1] Raw "Failed: {error._tag}" + invisible validation (roomCount regex silently fails; dialog stale failure persists on reopen). Fix: human copy near source, wire s.errors into inline fields, reset mutation state on open.
4. [P1] Inline add forms: 5–7 same-weight controls in one wrapped row, placeholder-only labels, label-swap "+ add"/"cancel" toggle, focus never moves in, no Escape. Fix: visible labels, stable button + close, two-column grids, focus first field on open.
5. [P2] Empty/zero states teach nothing: zero-match search renders a blank void; "No hotels yet." bare titles though kumo Empty supports description/contents. Fix: "no matches — clear search" action; per-section teaching empty states.

## Persona Red Flags
Alex: no quick-add/shortcut/bulk; typo is permanent; stage Select per row with no confirm; no list-level deal visibility ("what's hot" requires opening every business).
Sam: two h1s per page; row onClick not focusable (big cursor hit area excludes keyboard); placeholder-as-label (no visible labels); SR hears raw slugs ("sample hyphen sent") and "Failed: hotels/not-found"; no aria-live for row patch-in or stage change; focus stays on toggle when form opens, Escape dead; slate-500 on cream ≈4.5:1 (fails at text-xs), rose-600 ≈4.4:1 (below AA).

## Minor Observations
Industry duplicated per row (text + badge, "business" badge noise); "N shown" with no total; "← all businesses" styled as body text; annualValue derivation unexplained; deal stage silently defaults to prospect; deal notes collected but never displayed; toLocaleString() without locale / UTC date fmt; no autoComplete; dialog keeps stale state across open/close; "https://…" literal ellipsis placeholder; OTP flow has no resend/escape; empty Dashboard nav promises an overview the CRM never feeds.

## Questions to Consider
- What if the business list carried the pipeline (deals by stage, next action, annual value) so "what's hot" never requires opening each business?
- What if deal stages were a kanban board per business instead of a 6-option Select in a row?
- Was create-only a deliberate V1 cut or an unexamined default?
- What would a "won" moment look like (confirmation + next step: send the guide)?

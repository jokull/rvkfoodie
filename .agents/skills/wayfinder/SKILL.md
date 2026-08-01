---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of decision tickets in .wayfinder/, and resolve them one at a time until the way to the destination is clear. Use when a loose idea or big product scope needs to become a spec or plan, or when asked to chart, wayfind, or harvest product decisions.
---

A loose idea has arrived — too big for one agent session, and wrapped in fog:
the way from here to the **destination** isn't visible yet. Wayfinding is
about finding that way, not charging at the destination. This skill charts the
way as a **shared map** at `.wayfinder/map.md`, then works its **decision
tickets** — questions whose resolution is a decision, not slices of a build to
execute — one at a time until the route is clear.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the
map is done when the way is clear. The pull to just do the work is usually the
signal you've reached the edge of the map and it's time to hand off. An effort
can override this in its **Notes** — carrying execution into the map itself —
but absent that, produce decisions, not deliverables.

## Tracker: local markdown

This repo uses the local-markdown tracker (no issue service):

- Map: `.wayfinder/map.md` — the canonical artifact, an index not a store.
- Tickets: `.wayfinder/tickets/NN-slug.md` — one decision per file.
- Closed tickets move to `.wayfinder/closed/NN-slug.md`.
- Superseded branches move to `.wayfinder/superseded/<branch>/`.

A ticket is **unblocked** when every ticket it references as blocking is
closed; the **frontier** is the open, unblocked tickets — the edge of the
known.

### The map body

```markdown
# Map: <one-line destination statement>

`wayfinder:map`

## Destination

<what reaching the end of this map looks like — the spec, decision, or change. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

- [<ticket title>](tickets/NN-slug.md) — <one-line gist of the answer>

## Not yet specified

<in-scope fog you can't ticket yet; graduates as the frontier advances>

## Out of scope

<work ruled beyond the destination; closed, never graduates>
```

### Ticket body

```markdown
# <ticket title>

`wayfinder:<type>` — blocking: <ticket titles, or none>

## Question

<the decision or investigation this ticket resolves>
```

Ticket types:

- **research** (AFK): read docs / APIs / local resources to surface a fact a
  decision waits on. The agent drives it alone.
- **prototype** (HITL): raise fidelity with a cheap, rough, concrete artifact
  to react to (outline, stub, rough UI/logic). Link the prototype as an asset.
- **grilling** (HITL): conversation, one question at a time, never answering
  the human's side. The default case.
- **task** (HITL or AFK): manual work that must happen before a *decision* can
  be made — provisioning, moving data, signing up. The one type that *does*
  rather than decides.

## Fog of war

Don't chart what you can't yet see. **Not yet specified** holds the dim view:
questions you know are coming but can't pin down. Ticket when the question is
sharp — even if blocked. Fog or ticket? The test is whether you can state the
question precisely now. Out-of-scope work never graduates.

## Invocation

**Chart the map** (user invokes with a loose idea):

1. **Name the destination** — grill to pin down what this map is finding its
   way to. The destination fixes scope, so it's settled first.
2. **Map the frontier** — grill again, breadth-first: fan out across the whole
   space, surfacing open decisions and first steps. If this surfaces no fog,
   the way is clear — no map needed; say so.
3. **Create the map** — Destination and Notes filled, Decisions-so-far empty,
   fog sketched into **Not yet specified**.
4. **Create the tickets** you can specify now; wire blocking edges in a second
   pass.
5. Fire research subagents for research tickets if any.
6. Stop — charting is one session's work; it hand-resolves nothing.

**Work through the map** (user invokes with a ticket or the map):

1. Load `.wayfinder/map.md`.
2. Choose the ticket (user-named, else first frontier ticket). **Claim it**
   before working.
3. Resolve it — grill as needed; one question at a time, HITL.
4. Record the resolution: move the ticket to `closed/` with the answer
   appended, and append a context pointer to the map's Decisions so far.
5. Add newly-surfaced tickets; graduate fog that is now specifiable; rule
   out-of-scope work out rather than resolving it on the route.

**Reach the destination** — frontier empty: assemble the Destination, Notes,
and Decisions so far into the deliverable (spec or plan), zooming into closed
tickets for detail. That artifact is the handoff, not execution.

This repo's sub-skills (`/grilling`, `/domain-modeling`, `/research`,
`/prototype`) are not installed — run the equivalent inline, and consult the
`grill-me` skill for the grilling method.

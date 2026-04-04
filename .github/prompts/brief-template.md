# Lip Service — Editorial Brief Template

Paste this into the `brief` field when triggering a manual run via `workflow_dispatch`.
Leave blank for a freely-generated issue.

---

## Issue Brief

**Issue number:** (leave blank to auto-detect next number)

**Angle / theme this issue:**
<!-- One sentence on the editorial focus or hook, e.g. "Spring lip filler surge + new ceramide safety data" -->

---

### Section pegs (fill in what you have, leave blank what you don't)

**Injection Report:**
<!-- e.g. New Allergan data on longevity of Juvederm Volbella; Planned Parenthood expanding injector training -->

**Put It In Your Mouth:**
<!-- e.g. Lancet meta-analysis on collagen peptides and lip plumpness; cheat meal = burrata toast at Erewhon -->

**Lip Lab:**
<!-- e.g. Charlotte Tilbury reformulated Pillow Talk — new formula dropped Tuesday -->

**Lips in 6 (any items to include or avoid):**
<!--
Include: ...
Avoid: ...
-->

**Quick Hits:**
<!--
Best Kiss candidate: ...
Keep It Out candidate: ...
Healthy Tears link: ...
Other items: ...
-->

**On Our Calendar:**
<!-- Upcoming launches, events, or cultural moments this week or next -->

---

### Rotation / sponsored
<!-- Product recs for In Our Rotation (2 per slot × 2 slots = 4 total) -->

---

### Notes for the editor
<!-- Anything else — tone shift, reader feedback to address, things to avoid this week -->

---

## Schedule

| Run | Trigger | Publishes |
|-----|---------|-----------|
| Auto-generate | Mon 8pm PST (Tue 04:00 UTC) | Tue 4am PST |
| Auto-generate | Fri 8pm PST (Sat 04:00 UTC) | Sat 4am PST |
| Manual | `workflow_dispatch` → mode: `immediate` | Immediately |
| Manual (preview) | `workflow_dispatch` → mode: `preview` | Next publish window |

Auto-generated issues run in `preview` mode by default — they are saved to `preview/`
and scheduled in beehiiv, but not promoted to `issues/` until the publish workflow runs
8 hours later. Use `workflow_dispatch` with `mode: immediate` to skip the preview window.

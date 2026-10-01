# Design notes

Written with the frontend-design skill (`.claude/skills/frontend-design`). Read this before changing how the app looks.

## Subject, audience, job

- **Subject:** the front desk of a Tae Kwon Do school. Families inquire, try a class, and sign up.
- **Audience:** Ulices runs it day to day on a laptop. Master P checks it on his phone between classes.
- **Primary job:** show who to contact today, and where every family stands on the way to enrolling.

## Tokens

| Name | Light | Use |
|---|---|---|
| Navy | `#13213f` | Sidebar, headings, primary buttons. Carries over from the tuition dashboard. |
| Mat | `#eef1f5` | Page background. A cool, slightly blue grey like a training floor, not cream. |
| Paper | `#ffffff` | Panels and cards. |
| Belt gold | `#f2b91f` | The single accent: current nav item, today, keyboard focus. |
| Signal red | `#c4302b` | Overdue only. Never decoration. |
| Line | `#d9dfe8` | Hairlines and borders. |

Dark mode swaps to a deep navy floor (`#0d1526`) with the same gold.

**Type:** Barlow Condensed for headings and numbers, Barlow for everything else. Same families as the existing tuition dashboard, so the two feel like one product. Headings are sentence case: no all-caps eyebrows or tracked labels.

## The one bold idea: the belt

Pipeline stages borrow belt colors, in order:

```
New inquiry   Contacted   Trial scheduled   Trial completed   Decision pending   Enrolled
  white    →   yellow   →      green      →       blue      →        red       →   black
```

A lead "earns belts" as it moves toward enrolling. Nurture and Lost sit off the track (no belt). The belt shows up in exactly three places: the stage track at the top of the pipeline and dashboard, the stage tag on each lead, and the column heads on the board. Everything else stays quiet: white panels, hairlines, navy text.

## Layout

```
desktop                                   phone
┌────────┬───────────────────────────┐    ┌─────────────────────┐
│ navy   │ page title       actions  │    │ title        + Add  │
│ side   │ ───────────────────────── │    │ content             │
│ bar    │ content (max 1280px)      │    │                     │
│        │                           │    │                     │
│ gold   │                           │    ├─────────────────────┤
│ marker │                           │    │ tab bar (5 icons)   │
└────────┴───────────────────────────┘    └─────────────────────┘
```

- Content is left aligned. Numbers are right aligned in tables.
- Lead details open in a side panel over the list (full screen on phones), so you never lose your place in the list.
- The dashboard opens with today's work (trials, follow-ups, new inquiries), not a row of big numbers. Numbers come second.

## Rules

- Color encodes meaning: belt colors mean stage, red means overdue, gold means "now/you are here". Nothing else gets color.
- Motion only answers an action: the drawer slides in, a card lifts while dragged. No entrance animations.
- Copy is plain and specific. Buttons name the action ("Log contact", "Book trial", "Enroll"). Empty states say what to do next.
- Parent-facing wording never calls classes "games"; it is structured martial arts training.
- Every view works at 360px wide, has visible keyboard focus, and respects reduced motion.

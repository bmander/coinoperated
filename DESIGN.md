# CoinOperatedBrandon — Design Document

## Concept

CoinOperatedBrandon is a platform where anyone can propose civilization-spanning
infrastructure tasks, pledge money toward them, and one person (Brandon) decides
which ones to do. Pledges serve as weighted votes: putting a credit card behind a
request is a fundamentally different signal than clicking an upvote button.

Brandon retains full discretion. The pledge board is a landscape of priced
signals, not a job queue. Sometimes a $200 task is more compelling than a $5,000
one because it's tractable, interesting, or helps a lot of people.

### Core Loop

1. Anyone can post a task (a wish, a bug, a feature, a spec, a standard)
2. Anyone can pledge money toward any task
3. Pledges accumulate as visible, weighted votes
4. Brandon reviews the board, picks what to work on, and ships it
5. On completion, pledgers are charged; failed charges just fail
6. Brandon posts evidence of completion; the task closes

### What This Is Not

- **Not a contract.** Brandon is not an employee of the pledge pool.
- **Not an escrow service.** No money moves until work is done.
- **Not a democracy.** Pledges inform; they don't compel.
- **Not limited to software.** Tasks can involve specs, standards, advocacy,
  hardware, data, documentation, or anything else.

---

## User Roles

### Brandon (Operator)

- Views the full task board with pledge totals
- Posts tasks he's inclined to work on ("tip the scales")
- Marks tasks as: **accepted** (working on it), **completed** (done, triggers
  charge), or **declined** (not gonna happen, releases pledges)
- Posts progress updates on accepted tasks
- Provides evidence of completion against stated criteria
- Triggers charge collection on completed tasks

### Patrons (Everyone Else)

- Browse the task board (no account required)
- Create an account to submit tasks or pledge
- Submit new tasks with a description and suggested delivery criteria
- Pledge money ($5 minimum) toward any open task
- Receive notification when a pledged task is completed or declined
- View aggregate pledge totals and patron counts per task (not individual amounts)

---

## Task Lifecycle

```
                ┌──────────────────────────────┐
                │                              │
                ▼                              │
┌─────────┐  accept  ┌──────────┐  complete  ┌─────────────┐
│  OPEN   │ ───────► │ ACCEPTED │ ─────────► │ COLLECTING  │
└─────────┘          └──────────┘            └─────────────┘
    │                     │                        │
    │ decline             │ abandon                │ charges settle
    ▼                     ▼                        ▼
┌─────────────┐    ┌─────────────┐          ┌─────────────┐
│  DECLINED   │    │    OPEN     │          │  COMPLETED  │
│ (pledges    │    │ (returned)  │          │ (with stats)│
│  released)  │    └─────────────┘          └─────────────┘
└─────────────┘
```

### States

- **OPEN** — Accepting pledges. Anyone can pledge. This is the default and
  potentially permanent state. Tasks can sit here for years.
- **ACCEPTED** — Brandon is actively working on it. Pledges remain open
  (people can still pile on). Progress updates posted here.
- **COLLECTING** — Work is done. Evidence posted. Stripe is attempting to
  charge all pledgers. This is a transient state.
- **COMPLETED** — Charges have settled. Shows "collected $X of $Y pledged"
  and the completion evidence. Terminal state.
- **DECLINED** — Brandon has explicitly said no. All pledge authorizations
  are released. Patrons are notified. Terminal state. This is an act of
  honesty — better than letting something sit open forever.

### Abandonment

If Brandon accepts a task and later decides to stop, it returns to OPEN.
Pledges are preserved. No one is charged. This should feel low-stakes.

---

## Payment Model

### Pledge Flow (Stripe SetupIntents)

1. Patron clicks "Pledge $N" on a task
2. Stripe Checkout collects card details via a SetupIntent
3. A PaymentMethod is stored (tokenized, never raw card data)
4. The pledge is recorded: patron, task, amount, payment method, timestamp
5. No charge occurs. The card is on file for later.

### Collection Flow (Stripe PaymentIntents)

1. Brandon marks a task as completed and provides evidence
2. System creates a PaymentIntent for each pledge against the stored
   PaymentMethod
3. Charges are attempted in batch
4. Successful charges are recorded; failed charges are recorded as failed
5. No retry logic. No dunning. If the card doesn't work, it doesn't work.
6. Task moves to COMPLETED with stats: pledged vs. collected

### Key Decisions

- **Minimum pledge: $5.** Stripe's fixed fee (~$0.30) makes anything smaller
  economically irrational. Signal value of sub-$5 pledges doesn't justify the
  processing overhead.
- **No charge caps or funding goals.** Tasks can accumulate unlimited pledges.
  Brandon decides what's worth doing regardless of total.
- **Failed charges are silent.** Patrons whose cards fail are not pestered.
  They pledged in good faith; the card went stale. That's fine.
- **No refunds needed.** Because charges only happen on completion, there's
  nothing to refund. The "refund" is the task being declined or never done.
- **Platform fee: 0%.** This is a personal platform. Stripe takes ~2.9% + $0.30
  per charge. That's the only overhead.

### Stripe Integration Surface

| Stripe API           | Purpose                                           |
|----------------------|---------------------------------------------------|
| SetupIntent          | Collect and store payment method at pledge time    |
| Customer             | One per patron, holds payment methods              |
| PaymentMethod        | Stored card token, attached to customer            |
| PaymentIntent        | Created at collection time, one per pledge         |
| Webhook (optional)   | Listen for payment_intent.succeeded / .failed      |

---

## Data Model

### Patron

```
patron
  id              UUID
  email           TEXT UNIQUE NOT NULL
  display_name    TEXT
  stripe_customer TEXT NOT NULL        -- Stripe Customer ID
  created_at      TIMESTAMPTZ
```

### Task

```
task
  id              UUID
  title           TEXT NOT NULL
  description     TEXT NOT NULL        -- Markdown
  criteria        TEXT                 -- What "done" looks like, Markdown
  submitted_by    UUID REFERENCES patron (nullable — Brandon can post too)
  status          ENUM (open, accepted, collecting, completed, declined)
  evidence        TEXT                 -- Completion evidence, Markdown
  pledge_count    INT DEFAULT 0        -- Denormalized
  pledge_total    INT DEFAULT 0        -- Cents, denormalized
  collected_total INT DEFAULT 0        -- Cents, after charges settle
  created_at      TIMESTAMPTZ
  accepted_at     TIMESTAMPTZ
  completed_at    TIMESTAMPTZ
  declined_at     TIMESTAMPTZ
```

### Pledge

```
pledge
  id              UUID
  patron_id       UUID REFERENCES patron NOT NULL
  task_id         UUID REFERENCES task NOT NULL
  amount          INT NOT NULL         -- Cents, minimum 500
  payment_method  TEXT NOT NULL        -- Stripe PaymentMethod ID
  setup_intent    TEXT NOT NULL        -- Stripe SetupIntent ID
  status          ENUM (active, collected, failed, released)
  payment_intent  TEXT                 -- Set during collection
  created_at      TIMESTAMPTZ
  collected_at    TIMESTAMPTZ

  UNIQUE (patron_id, task_id)          -- One pledge per patron per task
                                       -- (they can update the amount)
```

### Update

```
update
  id              UUID
  task_id         UUID REFERENCES task NOT NULL
  body            TEXT NOT NULL        -- Markdown
  created_at      TIMESTAMPTZ
```

### Notes on the Schema

- **One pledge per patron per task.** A patron can increase their pledge but
  doesn't create multiple entries. This keeps the model clean and the UI simple.
- **Denormalized counts on task.** Avoids expensive aggregation queries on
  every board view. Updated via triggers or application logic on pledge
  insert/update.
- **Cents everywhere.** Never store money as floats. Stripe works in cents.
  The database works in cents. The UI formats for display.
- **Markdown for all long text.** Tasks, criteria, evidence, and updates are
  all Markdown. Render on the frontend.

---

## Patron-Facing Experience

### The Board (Homepage)

The landing page is the task board. No login required to browse.

```
┌──────────────────────────────────────────────────────┐
│  CoinOperatedBrandon                       [Sign In] │
│                                                      │
│  Infrastructure tasks, funded by people who care.    │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Sort: [Most Pledged ▼]  Filter: [All ▼]            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ ★ ACCEPTED                                     │  │
│  │ GTFS-rt validation tool for transit agencies    │  │
│  │ 23 backers · $2,140 pledged                    │  │
│  │ [View] [Pledge]                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ OPEN                                           │  │
│  │ Standard for bike-share GBFS ↔ GTFS interop    │  │
│  │ 8 backers · $430 pledged                       │  │
│  │ [View] [Pledge]                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ OPEN                                           │  │
│  │ Fix the sidewalk on 35th Ave SW                │  │
│  │ 2 backers · $15 pledged                        │  │
│  │ [View] [Pledge]                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Submit a Task]                                     │
└──────────────────────────────────────────────────────┘
```

### Task Detail Page

Shows full description, delivery criteria, pledge stats (aggregate only),
progress updates, and completion evidence if done.

### Pledge Flow

1. Click "Pledge" on a task
2. If not signed in, create account (email + Stripe Checkout for card)
3. Enter pledge amount (minimum $5, suggested amounts at $5 / $25 / $100)
4. Stripe Checkout collects card via SetupIntent
5. Pledge confirmed. Patron sees it in their dashboard.

### Patron Dashboard

- List of active pledges with task status
- Notification history (task accepted, completed, declined)
- Ability to increase/decrease/cancel a pledge

---

## Brandon-Facing Experience

### Admin Dashboard

- Task board with full stats and pledge breakdown
- Quick actions: accept, decline, mark complete
- Markdown editor for posting updates and evidence
- "Collect" button on completed tasks (triggers batch charge)
- Collection results: succeeded / failed / total

The admin experience should be minimal. This is a tool for one person.
A single page with a task list and action buttons is sufficient.

---

## Technology Stack (Suggested)

This is a simple CRUD app with Stripe integration. Keep it boring.

| Layer        | Choice                          | Rationale                        |
|--------------|---------------------------------|----------------------------------|
| Database     | PostgreSQL                      | Reliable, rich types, JSONB      |
| Backend      | Python (Flask or FastAPI)       | Brandon knows it, quick to build |
| Frontend     | Server-rendered HTML + htmx     | Minimal JS, fast iteration       |
| Payments     | Stripe (SetupIntents + PI)      | Industry standard, great docs    |
| Auth         | Email magic links               | No passwords to manage           |
| Hosting      | Fly.io or Railway               | Simple deployment, cheap         |
| Markdown     | python-markdown or mistune      | Server-side rendering            |
| Email        | Postmark or SES                 | Transactional notifications      |

### Why Not a SPA?

The patron experience is read-heavy and form-light. Server-rendered HTML with
htmx for the few interactive bits (pledge flow, admin actions) is dramatically
less complexity than a React app and works better for the audience: regular
people who ride the bus, not developers.

---

## Open Questions

1. **Identity for task submitters.** Do patrons need to be identified to submit
   tasks, or can tasks be submitted anonymously? Anonymous submission invites
   spam. Email-gated submission is probably sufficient.

2. **Pledge visibility.** Current design shows aggregate only. Should patrons
   have the option to be publicly listed as a backer? Some people want credit
   for supporting public goods.

3. **Task categories / tags.** Is a flat list enough, or does the board need
   structure? Categories like "transit," "open data," "standards," "physical
   infrastructure" might help as the list grows.

4. **What counts as evidence?** For software tasks, a merged PR or a live URL
   is pretty clear. For standards work or advocacy, completion is fuzzier.
   This probably doesn't need a technical solution — just honest prose.

5. **Multiple workers.** The current design assumes Brandon is the sole
   implementer. If he wants to bring in collaborators on a task, how does
   payment split? Probably out of scope for v1.

6. **Task expiration.** Should tasks auto-decline after some period? Probably
   not — a task sitting open for two years is fine. The pledges are just
   signals. But there might be value in a periodic "still want this?" email
   to pledgers on very old tasks.

---

## MVP Scope

The smallest thing that works:

- [ ] Landing page with task list (public, no auth)
- [ ] Task detail page with description, criteria, pledge stats
- [ ] Patron signup via email magic link
- [ ] Stripe SetupIntent integration for pledging
- [ ] Task submission form (authenticated)
- [ ] Admin page for Brandon (accept / decline / complete / collect)
- [ ] Batch charge on completion via Stripe PaymentIntents
- [ ] Email notifications (task accepted, completed, declined, charge result)

**Explicitly not in v1:** comments, task editing by submitters, public backer
lists, categories, search, OAuth login, mobile app.

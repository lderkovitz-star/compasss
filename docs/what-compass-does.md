# What Compass does, and what it does not

Written so that sales material, the website and this repository say the same
thing. If a claim is not on this page, it is not something the platform does
out of the box.

Keep it current. The cost of a capability page that drifts is a buyer who
discovers the gap during a pilot rather than during a demo.

---

## What it does

**Runs a scenario-based decision simulation.** A candidate works through a
pack of situations, each with two or more defensible options, under a per
scenario time limit. There is no visible countdown — pacing is recorded, not
performed at the candidate.

**Scores against the pack's own traits.** Every pack declares its own
dimensions. Scores are normalised against the range that pack could actually
reach across the scenarios a candidate was served, so packs of different
lengths and different weight scales stay comparable. A dimension no served
option could move is marked unexercised and left out rather than reported as
a zero.

**Records behavioural telemetry.** Time per decision, option revisits,
decision path. Used as evidence alongside the scores, never on its own.

**Reads attached documents.** A PDF or DOCX CV is uploaded, its text is
extracted, and that text is given to the AI as context when a result is
written. See the note below for what this is *not*.

**Holds scores from elsewhere.** ASVAB lines, academic baselines,
certifications — recorded as key/value entries on the candidate profile and
given to the AI as a separate kind of evidence from the simulation.

**Answers an evaluator's questions.** A free-text box on the review dashboard
takes a question in plain English — "why candidate 1 over candidate 2", "who
handles ambiguity best", "where is the evidence thin" — and answers it from
the simulation records of the candidates in scope.

**Ranks and compares a shortlist.** Against a pasted job spec, with a
combined comparison table across up to six candidates.

**Separates tenants.** Each employer account sees only its own candidates,
sessions and reports. Practice runs belong to no employer and appear in no
employer's ledger.

**Issues invitation links.** Single-use, expiring, unguessable. Issued by the
employer, or by the platform team on their behalf.

**Records consent.** Each sitting stores the statement the candidate agreed
to, verbatim, with the version and timestamp.

---

## What it does not do

**It is not an applicant tracking system, and it does not replace one.** It
holds no requisitions, no pipeline stages, no application forms, no
scheduling, no offer management. It is designed to sit next to an ATS, not
instead of it.

**It does not parse CVs into structured fields.** This is the distinction
that matters most when a buyer compares us to an ATS, so it is worth being
exact.

We *do* extract the text of an uploaded CV and give it to the AI as context.
That is real and it works.

We do *not* turn a CV into structured data — no parsed employment history, no
extracted skills taxonomy, no normalised education records, no years-of-
experience field you can filter or sort on. Nothing in the product sorts,
screens or ranks candidates by CV content, and no keyword filter exists.

A buyer who hears "resume parsing" from an ATS vendor means the second thing.
Say "the CV is read and given to the evaluation as context" and the
difference is clear. Saying "resume parsing" without qualification is the
claim that will not survive a pilot.

**It does not screen candidates in or out.** Nothing is auto-rejected, auto-
advanced or auto-filtered. The AI explains evidence to a person who decides,
and says so on every answer it produces.

**It does not measure biometrics.** Heart rate and physiological telemetry
were removed from the product. Anything describing live biometric monitoring
is out of date.

**It does not compare against an external benchmark population.** Percentiles
are computed against candidates evaluated on this platform, which starts
small. Any claim of comparison against a large external corpus is false. The
approved wording is "percentiles reflect real-time comparison against
evaluated platform candidates."

**It does not send email until the sending domain is verified.** Messages are
queued and visible in-app meanwhile.

**It does not diagnose.** It is a work-related assessment of decision-making,
not a psychological or medical instrument, and the candidate consent
statement says so.

---

## Where it belongs in a hiring process

Compass is a **validation layer at the shortlist stage**, not a front door.

This is a positioning decision with a practical reason behind it. A senior
candidate who is being courted will not complete an unsolicited timed
simulation to enter a pipeline, and asking them to is a good way to lose
them. The same candidate will usually complete one at final-stage, when they
are already invested, the employer has already shown interest, and it is
framed as the last step rather than the first gate.

The product is built around that. Assessments are invitation-only by
construction — there is no open application route, no self-serve queue, and
no way for a candidate to arrive without an employer having issued them a
link. The public practice sandbox is deliberately separate: it is anonymous,
its results are partial, it belongs to no employer, and nothing from it
reaches a hiring decision.

What to say: *Compass is the final-stage validation step for candidates you
have already shortlisted.* What not to say: anything implying volume
screening, top-of-funnel filtering, or application intake.

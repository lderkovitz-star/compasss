# Scenario pack format

A pack is one assessment: a set of scenarios, each with its options and the
dimension weights those options carry. Packs are uploaded from Master Admin and
assigned per client account, so authoring a new one never disturbs a pack that
is already running.

There is no fixed length. A pack may hold 5 scenarios or 200; the assessment
runs whatever it contains, and scores are normalised against what was actually
achievable in that session, so packs of different sizes stay comparable.

## JSON

```json
{
  "package": {
    "name": "Fleet Operations Crisis",
    "code": "FLEET_OPS_V1",
    "description": "High-tempo naval crisis command simulation",
    "version": "1.0.0"
  },
  "scenarios": [
    {
      "sequenceOrder": 1,
      "externalRef": "FLEET-001",
      "title": "The Outdoor Store",
      "narrativeText": "The full briefing the candidate reads...",
      "decisionPoint": "You're holding the $500 credit. What do you buy?",
      "timeLimitSec": 90,
      "options": [
        {
          "label": "A",
          "title": "The Hiking Upgrade",
          "text": "You grab professional-grade boots and trekking poles...",
          "scores": { "RISK_TOLERANCE": 8, "DECISION_VELOCITY": 5 }
        },
        {
          "label": "B",
          "title": "Shared Shelter",
          "text": "You put the credit toward a four-season tent...",
          "scores": { "TEAM_FOCUS": 10, "RISK_TOLERANCE": -5 }
        }
      ]
    }
  ]
}
```

### Fields

| Field | Required | Notes |
|---|---|---|
| `package.name` | yes | Shown in Master Admin and on reports |
| `package.code` | yes | Unique identifier, uppercase with underscores |
| `package.description`, `package.version` | no | Defaults to empty and `1.0.0` |
| `sequenceOrder` | no | Order within the pack. Omit it and file order is used; must be unique within a pack |
| `externalRef` | no | Your own id for the scenario. Include it and re-importing an edited pack updates those scenarios instead of creating duplicates |
| `title` | no | Short name for the scenario |
| `narrativeText` | yes | The situation the candidate reads |
| `decisionPoint` | no | The question itself, shown under the narrative |
| `timeLimitSec` | no | Defaults to 90 |
| `options[].label` | yes | `A`, `B`, `C`… Two or more per scenario; four is not a limit |
| `options[].title` | no | Short name for the choice |
| `options[].text` | yes | The choice as the candidate reads it |
| `options[].scores` | yes | Dimension code → weight |

### Scores

Keys are dimension codes. An option only lists the dimensions it actually
moves — three or four is typical, and listing all of them is not required.

Weights may be negative. A negative weight is how you penalise a choice on a
dimension, and it is used in scoring, not ignored.

The scale is yours, as long as it is consistent within a pack. A pack scored
−10…+10 and a pack scored 0…100 both work, because normalisation is computed
per dimension from the range the pack itself makes achievable.

If a pack needs dimensions that do not exist yet, declare them:

```json
{
  "package": { "name": "...", "code": "..." },
  "dimensions": [
    { "code": "SELF_RELIANCE", "name": "Self Reliance", "category": "Disposition" }
  ],
  "scenarios": [ ... ]
}
```

## CSV

One row per option. Repeat the narrative only on the first row of each
scenario; blank cells inherit from the row above.

```csv
sequence,title,narrative,decision_point,time_limit_sec,option_label,option_title,option_text,RISK_TOLERANCE,TEAM_FOCUS
1,The Outdoor Store,"The full briefing...","What do you buy?",90,A,The Hiking Upgrade,"You grab professional-grade boots...",8,
1,,,,,B,Shared Shelter,"You put the credit toward a tent...",-5,10
```

Every column after `option_text` is a dimension code. Leave a cell empty when
that option does not touch that dimension.

## Uploading

Master Admin → Scenarios → Import. Drop the file in, and the uploader reports
what it found — scenario and option counts, and any row that failed — before
anything is written. Nothing is saved until the preview is accepted.

A newly imported pack is not live until it is assigned: to the public sandbox,
as the global client default, or to a specific client account.

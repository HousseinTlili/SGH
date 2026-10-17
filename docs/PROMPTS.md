# AI use log

One entry for every significant use of an AI assistant (course requirement, see Deliverables and Defence). Verify and understand everything before it is merged.

Template:

```
## Entry <number>
Context:      what I was working on
Prompt:       the exact prompt
Output used:  which part of the answer I used
Verification: how I checked it (ran it, tested it, read the docs)
Corrections:  what I had to fix or reject
Decision:     what I kept and why
```

## Entry 1
Context:      planning and Notion spec review, 2026-10-06 to 2026-10-17 (Claude Code)
Prompt:       "You are the lead engineer on the SGH hospital management project ... plan only" (full text in the session)
Output used:  docs/PLAN.md (findings M1-M10, B1-B20, phases), docs/DOCTOR-PLAN.md, docs/MASTER-PLAN.md, Decisions Log D21-D32 and the addenda in docs/NOTION-ADDENDA.md
Verification: every Notion page re-read and its last-edited time compared; web checks for Keycloak, Spring Cloud Gateway, Prism, RabbitMQ and Angular versions
Corrections:  spec gaps found by reading (for example the Reception job without a token, queues created too late) were written up as decisions
Decision:     decisions D21-D32 adopted as defaults

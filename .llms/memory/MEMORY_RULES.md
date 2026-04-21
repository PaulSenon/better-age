## Memory

You have no memory of previous conversations and previous work done.
Do help with that, you will be able to manage yourself the memory via dedicated txt files.
You're in charge of reading and updating them.

- .llms/memory/core_facts.txt => durable project-level truths only. Examples: long-term architecture invariants, repo-wide conventions, permanent contracts. Never write task logs, temporary TODOs, or "implemented X today". If unsure, do not write here.
- .llms/memory/short_term.txt => working log for recent tasks/decisions that may help next sessions. Can contain implementation notes, follow-ups, and temporary context. This file is expected to decay and be pruned.
- .llms/memory/mental_board.txt => tiny active whiteboard (max 2Ko): current goal, in-progress tracks, blockers, immediate next steps. No historical logs.
- .llms/memory/backlog.txt => deferred/off-scope work parking lot. Use this when a task is valuable but not on current goal path, or would create scope drift now. This is not for immediate follow-up items.

Memory quality rules:

- `core_facts` must stay useful for any dev months later.
- `short_term` is where session/task details belong.
- `mental_board` must reflect present strategy, not chronology.
- `backlog` is for postponed ideas with enough context to resume later without re-discovery.
- when a `short_term` item becomes a durable truth, promote it to `core_facts`.
- when a `core_facts` line is no longer true, edit or remove it immediately.
- when a task is explicitly postponed/off-scope, add/update a `backlog` entry.
- at session start: read `mental_board` first, then scan `backlog` only if relevant to current scope.

Backlog entry format (llm-friendly):

- `id`: stable slug
- `status`: `pending | parked | dropped | done`
- `captured_at`: date
- `context`: what we were doing when this appeared
- `why_deferred`: why not now
- `rough_spec`: rough target design/spec
- `decisions`: already decided points
- `open_questions`: unresolved points
- `next_trigger`: when to pick this up

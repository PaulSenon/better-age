---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.
Batch only trivial questions that are related and that you're almost sure of the answer.

After first user answer, create an append-only markdown file that will be used to log each turn of the grilling session. Choose a file name that reflect current grlling topic and prefix file with "0-GRILL-ME-".
You must keep this log (append only) up to date so the session outcomes can survive context compaction.

If a question can be answered by exploring the codebase, explore the codebase instead.

If a question can be illustrated with code example, pseudocode, black box interfaces, ascii representation, higher picture structure. Format question in the best possible form to minimise User cognitive load (User is visual learner and understand bettern when things are concrete examples)

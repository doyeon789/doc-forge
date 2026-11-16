# Flow: <feature name>

> Based on: <first 7 chars of hash>[ (includes uncommitted changes)]
> [Overview](../<TOP_DOCS.overview>) · [Architecture](../<TOP_DOCS.architecture>)

## In one line
What this feature does from the user's or system's point of view, in one sentence.

## Entry point
Where the flow starts (route, event, main, schedule, …), with a citation and a link to that file's doc.

## Steps
Follow the calls as a numbered list. For each step: which file/function (doc link), what it does and why, and a citation. Mark steps that cross a hidden connection.

## Sequence diagram
A Mermaid sequenceDiagram (15 participants or fewer; split into sections if more).

## Exceptions and failure paths
Where control goes off the happy path: validation failures, errors, transaction rollbacks, …

## Related docs
Links to the module docs and file docs this flow passes through.

# `<repo-relative file path>`

> Based on: <first 7 chars of hash>[ (includes uncommitted changes)]
> Part of: [module <module id>](<up>/<moduleDoc>) · [Architecture](<up>/<TOP_DOCS.architecture>)

## In one line
The role this file plays in the repo, in one sentence.

## Why it exists
What would break without this file, which problem it solves (cited, or `Assumption:`).

## Key parts
For each class/function/export: `name` + 2–3 lines on what it does, why, and a citation. Group trivial getters/helpers into one line.

## Connections
### Who calls this file
Call and import sites found by a repo-wide Grep. Each entry links to that file's doc, with a citation.
### What this file calls
Other files and external libraries this file uses. Files in the repo link to their docs.
### Hidden connections
Places linked through DI, events, routes, config binding, reflection or schedules (doc-style §5 pattern list). If none: "none found in the searched scope".

## Watch out when reading
Traps, side effects, order dependencies, behavior that differs from the name, code that looks outdated (mark with `Assumption:`).

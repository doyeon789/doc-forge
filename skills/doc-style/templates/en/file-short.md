# `<repo-relative file path>`

> Based on: <first 7 chars of hash>[ (includes uncommitted changes)]
> Part of: [module <module id>](<up>/<moduleDoc>) · [Architecture](<up>/<TOP_DOCS.architecture>)

## In one line
What this file is, in one sentence (DTO, constants, build config, DB migration, …).

## Role
What it holds and why it exists, in 2–5 lines. For a `secret` file: the key names seen in `keys` output and what each key is for (never the values).

## Where it has effect
Code that reads or writes this file, and places whose behavior changes with this config/schema. Link to file docs, with citations. For a config file, fill this by Grepping the code for every key as in doc-style §5 "Reverse check for config files" (including relaxed-binding variants). Keys used nowhere are listed as "no usage found".

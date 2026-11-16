# <project name> architecture

> Based on: <first 7 chars of hash>[ (includes uncommitted changes)]
> [Overview](<TOP_DOCS.overview>)

## At a glance
The whole structure in 3–5 lines: which layers and components exist and how they fit together.

## Layers
The layers (e.g. controller → service → repository), links to the modules in each layer, and why the layers are split this way.

## Dependencies between modules
A Mermaid flowchart (15 nodes or fewer; split if more) and the reason for each main dependency. Show hidden connections (events, config) too.

## Request and data flow
The path of one representative request from arrival to response/storage. A Mermaid sequenceDiagram plus a citation per step. Link to `04_flows/` for detailed flows.

## Configuration and external connections
Where config files, environment variables (names only), databases and external APIs connect.

## Watch out when reading
Structural traps, unusual paths, places that break the layer rules.

# Any Location documentation

This handbook describes the system as it is implemented. Begin with the path that matches your work.

## New developers

1. [Getting started](getting-started.md)
2. [System architecture](architecture/system-overview.md)
3. [Repository layout](reference/repository-layout.md)
4. [Testing and quality](development/testing.md)

## Operators and administrators

- [User guide](guides/user-guide.md)
- [Administrator guide](guides/administrator-guide.md)
- [Firebase integration](integrations/firebase.md)
- [Configuration reference](reference/configuration.md)
- [Production runbook](operations/runbook.md)
- [Security specification](security/security-specification.md)

## API consumers

- [API v1 guide](api/README.md)
- [Production API controls](api/production-api.md)
- Authenticated machine-readable contract: `GET /api/v1/openapi.json`

## Data engineers and reviewers

- [Location database model](architecture/location-database.md)
- [Data directory conventions](../data/README.md)
- [Uganda support-data integration](data/uganda-support-integration.md)
- [Uganda 2025 reconciliation](data/uganda-2025-reconciliation.md)
- [Electoral Commission 2022 source assessment](data/electoral-commission-2022.md)

## Assurance records

Audit documents under [`audits/`](audits/) are dated evidence, not current operating instructions. The latest review is [the 2026-10-20 system security audit](audits/system-security-audit-2026-10-20.md).

## Documentation rules

- Document only behavior confirmed in code or validated data.
- Use `referenceCode` in public examples; `uid` is an internal relational identifier.
- State whether a dataset is active, candidate, supporting, or historical.
- Never place Firebase Admin credentials, API keys, tokens, or personal data in documentation.
- Update the relevant page in the same commit as a behavior or configuration change.

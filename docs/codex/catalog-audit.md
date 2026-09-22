# Codex catalog audit

Audit of every entry in <code>docs/codex/tasks.json</code> against the dependency declaration in its canonical PRD/task heading. The JSON is only the executable representation. Conditional prose and non-task prerequisites are recorded in the last column rather than converted into invented task IDs.

| Task | PRD dependency text | Resulting dependsOn | Manual / unresolved dependency |
|---|---|---|---|
| <code>DOCS-001</code> | No matching PRD task heading/dependency declaration. | — | No PRD task heading; seeded documentation adoption task. |
| <code>SEC-001</code> | No explicit dependency in the PRD task heading. | <code>DOCS-001</code> | Security PRD declares this as the first code task but has no explicit dependency; DOCS-001 remains the documentation-adoption prerequisite from the execution plan. |
| <code>SEC-002</code> | **P0** — depende `SEC-001` | <code>SEC-001</code> | — |
| <code>SEC-003</code> | **P0** — depende `SEC-002` | <code>SEC-002</code> | — |
| <code>SEC-004</code> | **P0** — depende `SEC-003` | <code>SEC-003</code> | — |
| <code>SEC-005</code> | **P0** — depende `SEC-002` | <code>SEC-002</code> | — |
| <code>SEC-006</code> | **P0** — depende `SEC-005` | <code>SEC-005</code> | — |
| <code>CORE-001</code> | **Dependências:** SEC-001 | <code>SEC-001</code> | — |
| <code>ACC-001</code> | **P0** — depende `SEC-003`, `SEC-005` | <code>SEC-003</code>, <code>SEC-005</code> | — |
| <code>ACC-002</code> | **P0** — depende `ACC-001` | <code>ACC-001</code> | — |
| <code>ACC-003</code> | **P0** — depende `ACC-002` | <code>ACC-002</code> | — |
| <code>ACC-004</code> | **P0** — depende `ACC-002`, `CORE-001` | <code>ACC-002</code>, <code>CORE-001</code> | — |
| <code>ACC-005</code> | **P0** — depende `ACC-002` | <code>ACC-002</code> | — |
| <code>SEC-007</code> | **P0** — depende contratos estabilizados | <code>ACC-004</code> | PRD says stabilized contracts without enumerating them; ACC-004 is the concrete execution-plan proxy and broader stabilization still requires review. |
| <code>CORE-002</code> | **Dependências:** CORE-001, SEC-003 | <code>CORE-001</code>, <code>SEC-003</code> | — |
| <code>CORE-004</code> | **Dependências:** CORE-001, SEC-003 | <code>CORE-001</code>, <code>SEC-003</code> | — |
| <code>FIN-001</code> | **P0** — depende `CORE-001`, `SEC-003` | <code>CORE-001</code>, <code>SEC-003</code> | — |
| <code>FIN-002</code> | **P0** — depende `FIN-001` | <code>FIN-001</code> | — |
| <code>FIN-003</code> | **P0** — depende `FIN-002` | <code>FIN-002</code> | — |
| <code>FIN-004</code> | **P0** — depende `FIN-003` | <code>FIN-003</code> | — |
| <code>FIN-005</code> | **P0** — depende `FIN-004`, `CORE-004` | <code>FIN-004</code>, <code>CORE-004</code> | — |
| <code>CORE-006</code> | **Dependências:** CORE-001 | <code>CORE-001</code> | — |
| <code>FIN-006</code> | **P0** — depende `FIN-005`, `CORE-006` | <code>FIN-005</code>, <code>CORE-006</code> | — |
| <code>GRF-001</code> | **P0** — depende `SEC-003`, `CORE-001`, `FIN-002` | <code>SEC-003</code>, <code>CORE-001</code>, <code>FIN-002</code> | — |
| <code>GRF-002</code> | **P0** — depende `GRF-001` | <code>GRF-001</code> | — |
| <code>GRF-003</code> | **P0** — depende `GRF-001`, `FIN-002` | <code>GRF-001</code>, <code>FIN-002</code> | — |
| <code>GRF-004</code> | **P0** — depende `GRF-003`, `ACC-004` | <code>GRF-003</code>, <code>ACC-004</code> | — |
| <code>DOC-001</code> | **P0** — depende `SEC-003` | <code>SEC-003</code> | — |
| <code>DOC-002</code> | **P0** — depende `DOC-001`, `CORE-001` | <code>DOC-001</code>, <code>CORE-001</code> | — |
| <code>GRF-005</code> | **P0** — depende `GRF-004`, `DOC-002` | <code>GRF-004</code>, <code>DOC-002</code> | — |
| <code>GRF-006</code> | **P0** — depende `GRF-005` | <code>GRF-005</code> | — |
| <code>GRF-007</code> | **P0** — depende `GRF-006`, `CORE-004` | <code>GRF-006</code>, <code>CORE-004</code> | — |
| <code>GRF-008</code> | **P0** — depende `GRF-006`, `FIN-004` | <code>GRF-006</code>, <code>FIN-004</code> | — |
| <code>GRF-009</code> | **P0** — depende `GRF-006`, `FIN-004` | <code>GRF-006</code>, <code>FIN-004</code> | — |
| <code>GRF-010</code> | **P0** — depende `GRF-008`, `GRF-009`, `FIN-005` | <code>GRF-008</code>, <code>GRF-009</code>, <code>FIN-005</code> | — |
| <code>GRF-011</code> | **P1** — depende `GRF-010`, `FIN-005` | <code>GRF-010</code>, <code>FIN-005</code> | — |
| <code>GRF-012</code> | **P1** — depende `GRF-007`, `GRF-010` | <code>GRF-007</code>, <code>GRF-010</code> | — |
| <code>GRF-013</code> | **P1** — depende `GRF-010`, `09-migration-rollout` | <code>GRF-010</code> | Also requires the non-task rollout contract in docs/09-migration-rollout.md. |
| <code>GRF-014</code> | **P0 release gate** — depende `GRF-001..013` relevantes | <code>GRF-001</code>, <code>GRF-002</code>, <code>GRF-003</code>, <code>GRF-004</code>, <code>GRF-005</code>, <code>GRF-006</code>, <code>GRF-007</code>, <code>GRF-008</code>, <code>GRF-009</code>, <code>GRF-010</code>, <code>GRF-011</code>, <code>GRF-012</code>, <code>GRF-013</code> | The relevant range was expanded conservatively to every GRF-001 through GRF-013 task. |
| <code>FIN-007</code> | **P1** — depende `FIN-001`, `FIN-002` | <code>FIN-001</code>, <code>FIN-002</code> | — |
| <code>FIN-008</code> | **P1** — depende `DOC-002`, `FIN-003` | <code>DOC-002</code>, <code>FIN-003</code> | — |
| <code>FIN-009</code> | **P1** — depende `FIN-005`, `FIN-007` | <code>FIN-005</code>, <code>FIN-007</code> | — |
| <code>FIN-010</code> | **P1** — depende `FIN-005`, integrações GRF/INV/REI | <code>FIN-005</code>, <code>GRF-014</code>, <code>INV-004</code>, <code>REI-004</code> | GRF/INV/REI integrations are represented by their final gates GRF-014, INV-004, and REI-004. |
| <code>CORE-005</code> | **Dependências:** CORE-004, FIN-005, GRF-009 | <code>CORE-004</code>, <code>FIN-005</code>, <code>GRF-009</code> | — |
| <code>VAC-001</code> | **P0** — depende `CORE-001`, `SEC-003` | <code>SEC-003</code>, <code>CORE-001</code> | — |
| <code>VAC-002</code> | **P0** — depende `VAC-001` | <code>VAC-001</code> | — |
| <code>VAC-003</code> | **P0** — depende `VAC-002`, `CORE-006` | <code>VAC-002</code>, <code>CORE-006</code> | — |
| <code>VAC-004</code> | **P0** — depende `VAC-002` | <code>VAC-002</code> | — |
| <code>VAC-005</code> | **P0 release gate** — depende `VAC-001..004` | <code>VAC-001</code>, <code>VAC-002</code>, <code>VAC-003</code>, <code>VAC-004</code> | — |
| <code>INV-001</code> | **P0** — depende `FIN-004`, `CORE-001` | <code>FIN-004</code>, <code>CORE-001</code> | — |
| <code>INV-002</code> | **P0** — depende `INV-001` | <code>INV-001</code> | — |
| <code>REI-002</code> | **P0** — depende `FIN-004` | <code>FIN-004</code> | — |
| <code>REI-003</code> | **P0** — depende `CORE-001`, `INV-001` | <code>CORE-001</code>, <code>INV-001</code> | — |
| <code>INV-003</code> | **P1** — depende `INV-002`, `FIN-005` | <code>INV-002</code>, <code>FIN-005</code> | — |
| <code>INV-004</code> | **P0 release gate** — depende `INV-001..003` | <code>INV-001</code>, <code>INV-002</code>, <code>INV-003</code> | — |
| <code>REI-004</code> | **P0 release gate** — depende `REI-002..003` | <code>REI-002</code>, <code>REI-003</code> | — |
| <code>LIF-001</code> | **P1** — depende `ACC-003`, `CORE-004` | <code>ACC-003</code>, <code>CORE-004</code> | — |
| <code>LIF-002</code> | **P0** — depende `ACC-005` | <code>ACC-005</code> | — |
| <code>LIF-004</code> | **P0** — depende `LIF-002` | <code>LIF-002</code> | — |
| <code>PORT-001</code> | **P0** — depende `ACC-003` | <code>ACC-003</code> | — |
| <code>ACC-006</code> | **P1** — depende `ACC-003`, `ACC-004` | <code>ACC-003</code>, <code>ACC-004</code> | — |
| <code>PORT-002</code> | **P0** — depende `ACC-006` ou contratos atuais estabilizados | <code>ACC-006</code> | ACC-006 is the explicit task path; the PRD alternative of already-stabilized current contracts requires human confirmation. |
| <code>REI-001</code> | **P1** — depende `FIN-002`, `GRF-001` quando vínculo de OS for usado | <code>FIN-002</code> | GRF-001 remains conditional and manual when the implementation enables an OS link. |
| <code>EQP-001</code> | **P1** — depende `SEC-003`, `CORE-001` | <code>SEC-003</code>, <code>CORE-001</code> | — |
| <code>EXT-001</code> | **P1** — depende `SEC-003` | <code>SEC-003</code> | — |
| <code>SAA-001</code> | **P1** — depende `FIN-002`, `SEC-003` | <code>SEC-003</code>, <code>FIN-002</code> | — |
| <code>EQP-003</code> | **P1** — depende `EQP-001`, `CORE-004` | <code>EQP-001</code>, <code>CORE-004</code> | — |
| <code>EXT-002</code> | **P1** — depende `EXT-001`, `CORE-004` | <code>EXT-001</code>, <code>CORE-004</code> | — |
| <code>SAA-002</code> | **P1** — depende `SAA-001` | <code>SAA-001</code> | — |
| <code>SAA-003</code> | **P1** — depende `SAA-001`, `CORE-004` | <code>SAA-001</code>, <code>CORE-004</code> | — |
| <code>LIF-003</code> | **P1** — depende `EQP-001`, `EXT-002`, `SAA-002` | <code>EQP-001</code>, <code>EXT-002</code>, <code>SAA-002</code> | — |
| <code>EXT-003</code> | **P1** — depende `EXT-002` | <code>EXT-002</code> | — |
| <code>DOC-004</code> | **P0 release gate** — depende `DOC-001` | <code>DOC-001</code> | — |
| <code>EQP-002</code> | **P2** — depende `EQP-001` | <code>EQP-001</code> | — |
| <code>SAA-004</code> | **P2** — depende `FIN-007`, `SAA-001` | <code>FIN-007</code>, <code>SAA-001</code> | — |
| <code>DOC-003</code> | **P2** — depende decisão em `docs/decisions/` | — | Blocking business decision in docs/decisions is unresolved; automation=false and no task dependency can resolve it. |
| <code>CORE-003</code> | **Dependências:** CORE-002 | <code>CORE-002</code> | — |
| <code>CORE-007</code> | **Dependências:** CORE-004 | <code>CORE-004</code> | — |
| <code>PORT-003</code> | **P2** — após fluxos estabilizados. | <code>PORT-002</code> | PORT-002 is the concrete final portal-flow proxy; broader flow stabilization remains a human review condition. |
| <code>OPS-001</code> | No matching PRD task heading/dependency declaration. | <code>FIN-010</code>, <code>GRF-014</code>, <code>VAC-005</code>, <code>INV-004</code>, <code>REI-004</code>, <code>DOC-004</code> | No PRD task heading in the referenced rollout document; manual release prerequisites are retained from the execution plan. |
| <code>OPS-002</code> | No matching PRD task heading/dependency declaration. | <code>OPS-001</code> | No PRD task heading in the referenced runbook; manual operational dependency retained from the execution plan. |
| <code>OPS-003</code> | No matching PRD task heading/dependency declaration. | <code>OPS-001</code> | No PRD task heading in the referenced runbook; manual operational dependency retained from the execution plan. |
| <code>OPS-004</code> | No explicit dependency in the operational task heading. | <code>OPS-001</code>, <code>OPS-002</code>, <code>OPS-003</code> | Operational release task; dependencies come from the execution plan, not a product PRD heading. |

Validation requirements: task IDs are unique, every dependency resolves to a catalog ID, and the resulting graph is acyclic. DOC-003 remains manual until its business decision is documented.

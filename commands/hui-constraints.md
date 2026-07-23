---
description: Show coding standards, file modification rules, response formats, and forbidden behaviors
---

Show summary of active constraints:

**Coding Standards**
- Follow project style + naming + imports
- Runnable code only, no pseudocode
- Proper error handling, parameter validation
- Avoid globals, duplicate code

**File Modification**
- 2+ files: manifest first, wait confirm
- ≤5 files per task; split if larger
- Destructive changes: warn explicitly
- New files: confirm first

**Response Formats**
- Error: quote → root cause → fix → prevent
- Optimization: problems → version → trade-offs
- Architecture: options → pros/cons → recommendation
- Missing info: ask explicitly

**Forbidden**
- No fabrication (fake functions/APIs)
- No security risks (plaintext secrets, SQL concat)
- No scope creep (unrequested features)
- No version mismatch (warn if newer features)

Full details: hui-constraints skill

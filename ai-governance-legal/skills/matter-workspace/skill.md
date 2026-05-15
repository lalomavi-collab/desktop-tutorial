# Skill: matter-workspace

## Purpose

Manage isolated matter workspaces for multi-client private practice. Creates, lists, switches, and closes matter-specific contexts so that each client's AI governance work is isolated from other matters. Prevents context leakage across clients.

---

## Invocation

```
/ai-governance-legal:matter-workspace new [client/matter name]
/ai-governance-legal:matter-workspace list
/ai-governance-legal:matter-workspace switch [matter name]
/ai-governance-legal:matter-workspace close [matter name]
/ai-governance-legal:matter-workspace none
```

---

## Base path

All matter workspaces are stored under:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/
```

The active matter is tracked in:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/.active-matter
```

---

## Instructions

Read the practice profile at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md` to confirm the plugin is set up. If no profile exists, say: "No practice profile found. Run /ai-governance-legal:cold-start-interview first."

Determine subcommand from the argument:

---

### Subcommand: `new`

**Purpose:** Create a new isolated matter workspace.

**Steps:**

1. Ask if not provided:
   - Client name (use a placeholder if preferred)
   - Matter name or number
   - Matter type (e.g., AI contract review, AI impact assessment for client, regulatory inquiry, AI policy advisory)
   - Applicable regulations for this matter (may differ from firm defaults)
   - Key dates (e.g., filing deadline, agreement execution date, regulatory response due date)
   - Conflict check status: `[ATTORNEY DECISION REQUIRED: confirm conflicts cleared before creating matter workspace]`

2. Generate a matter slug from the client and matter name: lowercase, hyphens, no spaces. Example: `acme-corp-ai-procurement-review`.

3. Create the matter config file at:
   ```
   ~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/[matter-slug]/matter.md
   ```

   Use this format:
   ```markdown
   # Matter Workspace — [Client Name / Matter Name]

   > Created: [date]. This workspace is isolated — do not reference other matter contexts here.

   ## Matter profile
   - **Client:** [name or PLACEHOLDER]
   - **Matter name/number:** [name]
   - **Matter type:** [type]
   - **Created:** [date]
   - **Status:** Open

   ## Applicable regulations (matter-specific)
   [List regulations specific to this matter — may supplement or differ from firm defaults]

   ## Key dates
   [List deadlines, effective dates, response due dates]

   ## Matter-specific positions
   [Any positions, red lines, or conditions specific to this client/matter — override firm defaults where noted]

   ## Conflict check
   - Cleared: [Yes / No / Pending — ATTORNEY DECISION REQUIRED]
   - Cleared by: [role]
   - Date: [date]

   ## Notes
   [Attorney notes — free text]
   ```

4. Set this matter as the active matter by writing the matter slug to `.active-matter`.

5. Confirm creation:
   > "Matter workspace '[matter-slug]' created and set as active. All AI governance skill outputs in this session will reference this matter context. To return to firm-level context, run `/ai-governance-legal:matter-workspace none`."

6. Add a reminder: "Matter isolation is your responsibility — the plugin provides structure, not enforcement. Do not reference one client's information in another matter's workspace."

---

### Subcommand: `list`

**Purpose:** List all open matter workspaces.

**Steps:**

1. Read the `matters/` directory.
2. For each matter folder (excluding `archived/`), read `matter.md` and extract: client name, matter name, creation date, last modified date, status.
3. Output a table:

```
## Open Matter Workspaces

| Matter slug | Client | Matter name | Created | Last modified | Status |
|---|---|---|---|---|---|
| [slug] | [client] | [matter] | [date] | [date] | Open |

Active matter: [current active matter or "none — firm level"]
```

4. If no matters exist, say: "No matter workspaces found. Run `/ai-governance-legal:matter-workspace new` to create one."

---

### Subcommand: `switch`

**Purpose:** Switch the active matter context.

**Steps:**

1. Verify the matter slug exists in `matters/` (not archived).
2. If not found, list available matter slugs and ask the user to confirm the correct one.
3. Write the matter slug to `.active-matter`.
4. Read the matter's `matter.md` and display a brief summary.
5. Confirm:
   > "Active matter switched to '[matter-slug]'. AI governance skill outputs will now reference this matter context."

---

### Subcommand: `close`

**Purpose:** Archive a matter workspace when the matter is complete.

**Steps:**

1. Verify the matter slug exists.
2. **Gate behind explicit confirmation:**
   > "You are about to close matter '[matter-slug]'. This will move the workspace to `matters/archived/[matter-slug]/`. The files will be preserved but the matter will no longer appear in the active list. Are you sure? (yes / no)"
3. Only proceed after "yes" or explicit equivalent.
4. Move the matter folder to `matters/archived/[matter-slug]/`.
5. Update the matter's `matter.md` status to "Archived" and note the close date.
6. If this was the active matter, clear `.active-matter`.
7. Confirm:
   > "Matter '[matter-slug]' has been archived. If it was your active matter, you are now at firm level."

---

### Subcommand: `none`

**Purpose:** Clear the active matter and return to firm-level context.

**Steps:**

1. Read `.active-matter` to confirm what is currently active.
2. Delete or clear the `.active-matter` file.
3. Confirm:
   > "Active matter cleared. You are now working at firm level. AI governance skill outputs will use the firm practice profile only."

---

## Constraints

- Never create, switch, or close a matter without confirming the action with the user.
- The `close` subcommand is irreversible in the sense that files are moved — always confirm before proceeding.
- Matter isolation is structural only. The plugin cannot prevent an attorney from referencing matter A information in matter B — it is the attorney's professional responsibility to maintain client confidentiality.
- If the `.active-matter` file references a matter slug that does not exist (e.g., after a close), clear the file and say: "Active matter reference was stale — cleared. You are now at firm level."
- Conflict check status is always `[ATTORNEY DECISION REQUIRED]` — the plugin cannot perform or verify conflict checks.
- Do not include client-identifying information in skill output headers or footers that could leak across contexts.

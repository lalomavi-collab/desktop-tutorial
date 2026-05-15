# Skill: matter-workspace

## Purpose

Manage isolated matter workspaces for multi-client private practice. Provide structured context separation between client matters to support conflict management and reduce risk of inadvertent cross-matter data disclosure. Matter isolation is the attorney's responsibility — this skill provides structure, not enforcement.

---

## Invocation

```
/ai-governance-legal:matter-workspace new [client/matter name]
/ai-governance-legal:matter-workspace list
/ai-governance-legal:matter-workspace switch [matter name]
/ai-governance-legal:matter-workspace close [matter name]
/ai-governance-legal:matter-workspace none
```

If called without a subcommand, display the list of available subcommands and ask the user what they want to do.

---

## Configuration path

All matter workspace files are stored under:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/
```

Active matter is tracked in:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/.active-matter
```

---

## Instructions

You are assisting an attorney in managing matter workspaces for multi-client AI governance work. Before any operation, note:

> "Matter isolation is a structural aid — not an enforcement mechanism. You are responsible for ensuring that confidential information from one client matter is not disclosed or used in another matter context."

Read the practice profile at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md` before any operation, if it exists.

---

## Subcommand: new

### Purpose
Create a new isolated matter workspace for a specific client/matter.

### Steps

1. Parse the matter name from the argument. If not provided or ambiguous, ask:
   - Client name (use a placeholder if preferred)
   - Matter name or number
   - Matter type (e.g., AI governance review, AIA for client system, vendor contract review, regulatory compliance assessment, internal investigation)

2. Ask intake questions:
   - Which jurisdictions apply to this matter? (may differ from firm-level profile)
   - What regulations are relevant to this specific matter?
   - Are there any matter-specific red lines or constraints beyond the firm-level red lines?
   - Are there key dates (e.g., regulatory deadline, contract execution date, board presentation)?
   - Who is the responsible attorney for this matter?

3. Generate a matter slug: lowercase, hyphens only, max 40 characters. Example: `acme-corp-ai-procurement-2024`

4. Show the user the matter profile that will be created:

```
## Matter Profile — [Matter Name]
Created: [date]
Last modified: [date]
Status: Open

### Matter identification
- Client: [client name or placeholder]
- Matter name/number: [matter name/number]
- Matter type: [type]
- Responsible attorney: [name or role]
- Created: [date]

### Matter-specific jurisdictions
[List jurisdictions for this matter — may differ from firm-level profile]

### Matter-specific regulations
[List regulations applicable to this matter]

### Matter-specific red lines
[Any constraints specific to this client/matter, in addition to firm-level red lines]

### Key dates
[List key dates]

### Notes
[Any additional context]
```

5. Ask for confirmation before creating:
   > "I'll create this matter workspace at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/[matter-slug]/matter.md`. Shall I proceed? (yes / no)"

6. Only after explicit confirmation:
   - Create the directory `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/[matter-slug]/`
   - Write the matter profile to `matter.md`
   - Write the matter slug to `.active-matter` (switch to this matter as active)
   - Confirm: "Matter workspace `[matter-slug]` created and set as active. All AI governance outputs in this session will be labeled for this matter."

---

## Subcommand: list

### Purpose
List all open matter workspaces with status.

### Steps

1. Read the matters directory at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/`

2. For each matter directory (excluding `archived/`):
   - Read `matter.md`
   - Extract: client name, matter name, matter type, created date, last modified date, status

3. Read `.active-matter` if it exists to identify the currently active matter.

4. Output a table:

```
## Matter Workspaces

Active matter: [matter name or "None — working at firm level"]

| Matter | Client | Type | Created | Last Modified | Status |
|---|---|---|---|---|---|
| [matter-slug] | [client] | [type] | [date] | [date] | [Open / Active] |
[rows]

Archived matters: [count] (run `/ai-governance-legal:matter-workspace list` to show archived)
```

5. If no matters exist: "No matter workspaces found. Run `/ai-governance-legal:matter-workspace new [name]` to create one."

---

## Subcommand: switch

### Purpose
Switch the active workspace context to a specific matter.

### Steps

1. Parse the matter name from the argument. If ambiguous, show the list and ask the user to select.

2. Verify the matter exists at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/matters/[matter-slug]/matter.md`.

3. If not found: "Matter `[name]` not found. Run `/ai-governance-legal:matter-workspace list` to see available matters."

4. Write the matter slug to `.active-matter`.

5. Read the matter profile and confirm:
   > "Switched to matter: **[Matter Name]** ([client name])
   > Type: [matter type]
   > Jurisdictions: [list]
   > Key dates: [list]
   >
   > All subsequent AI governance outputs will be labeled for this matter. To clear the active matter, run `/ai-governance-legal:matter-workspace none`."

6. Note any matter-specific regulations or red lines that differ from the firm-level profile:
   > "Note: This matter has [N] matter-specific regulation(s) that supplement the firm-level profile: [list]."

---

## Subcommand: close

### Purpose
Archive a matter workspace.

### Steps

1. Parse the matter name from the argument. If ambiguous, show the list.

2. Verify the matter exists.

3. Read the matter profile.

4. **Gate behind explicit confirmation:**
   > "You are about to archive matter **[Matter Name]** ([client name]).
   > - The matter folder will be moved to `matters/archived/[matter-slug]/`
   > - The matter will no longer appear in the active matters list
   > - If this is the active matter, the active matter will be cleared
   >
   > This action can be reversed by moving the folder back manually.
   >
   > Are you sure you want to close this matter? (yes to confirm / no to cancel)"

5. Only after explicit "yes":
   - Create `matters/archived/` if it does not exist
   - Move `matters/[matter-slug]/` to `matters/archived/[matter-slug]/`
   - Update matter.md status to "Closed" and add closed date
   - If this was the active matter: clear `.active-matter`
   - Confirm: "Matter `[matter-slug]` archived. It can be found at `matters/archived/[matter-slug]/`. Active matter cleared."

6. If "no": "Close cancelled. Matter `[matter-slug]` remains open."

---

## Subcommand: none

### Purpose
Clear the active matter context and confirm working at firm level (not matter level).

### Steps

1. Read `.active-matter` if it exists. Note the current active matter (if any).

2. Clear `.active-matter` (delete or empty the file).

3. Confirm:
   > "Active matter cleared. Working at firm level.
   > No matter context is active — outputs will not be labeled for a specific client matter.
   > Reminder: confirm that no client-specific information is in your current session before proceeding with firm-level work."

---

## Cross-matter contamination warning

At any point during a session, if the user appears to reference information from a different matter than the currently active matter (e.g., references a client name, matter number, or fact pattern that does not match the active matter), flag it:

> "⚑ Possible cross-matter reference detected. You are currently working in matter **[active matter]**, but you appear to be referencing [description of reference]. If this is from a different client matter, please confirm the correct active matter before proceeding. Run `/ai-governance-legal:matter-workspace switch [matter name]` to switch matters."

This is a structural aid — the attorney is responsible for preventing cross-matter disclosure.

---

## Output gate

All consequential file operations (create, close/archive) require explicit user confirmation before proceeding. Switching active matter and listing matters do not require additional confirmation.

---

## Constraints

- Never create, close, or archive a matter workspace without explicit user confirmation.
- Never enforce matter isolation — provide structure and flag risks, but acknowledge that enforcement is the attorney's responsibility.
- If a matter workspace operation fails (e.g., directory cannot be created), report the error clearly and suggest manual steps.
- Do not expose one client's matter details while working in another client's matter context — matter profiles should be read only for the active matter unless explicitly requested.
- All operations that write files must confirm what was written and where.
- The `.active-matter` file contains only the matter slug — no client data.

# Skill: cold-start-interview

## Purpose

Interview the user to build or update their AI governance legal practice profile, then write the profile to `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md`.

This skill is always run first. Every other skill in this plugin reads the practice profile. The more complete the profile, the more tailored all subsequent outputs will be.

---

## Invocation

```
/ai-governance-legal:cold-start-interview
```

---

## Instructions

You are assisting an attorney or legal operations professional in setting up their AI governance legal practice profile. Work through the interview questions below, one section at a time. Do not ask all questions at once — group them logically and wait for answers before proceeding.

Before starting, say:

> "I'll ask you a series of questions to build your AI governance practice profile. This usually takes 10–15 minutes. The profile will be saved to your Claude config and used by every AI governance skill to tailor its output to your organization. You can skip any question and fill it in later. Let's start."

---

### Section 1 — Organizational basics

Ask the following, accepting free-text answers:

1. **What is your organization's name?** (Or use a placeholder if you prefer not to record it.)
2. **What role does your organization play with AI systems?**
   - Builder (you develop AI systems for others)
   - Deployer (you use AI systems built by others)
   - Both

3. **Which jurisdictions apply to your AI governance work?** (Select all that apply — prompt with common options if needed)
   - United States (federal)
   - European Union / EEA
   - United Kingdom
   - California
   - Colorado
   - Texas
   - New York / NYDFS
   - Illinois (BIPA)
   - Canada (PIPEDA / Law 25)
   - Other — specify

4. **What industry or sector are you in?** (e.g., financial services, healthcare, retail, technology, insurance, government, education, other)

5. **How large is your legal/governance team, and who does it report to?** (e.g., 3-person team reporting to GC; solo practitioner; governance team reporting to CRO)

---

### Section 2 — Regulatory scope

Say: "Now let's identify which regulations apply to your AI work."

6. **Which of these regulations do you believe apply to your organization?** Go through the list and ask the user to confirm each:

   - EU AI Act (as builder, deployer, or both)
   - Colorado AI Act (SB 24-205) — effective February 2026
   - Texas Responsible AI Governance Act (TRAIGA) — monitor status
   - New York City Local Law 144 — automated employment decisions
   - EEOC / Title VII — AI in employment screening
   - FCRA — AI in consumer credit/background screening
   - HIPAA / HITECH — AI involving health data
   - CCPA / CPRA — AI involving California consumer data
   - NYDFS Circular Letter — insurance AI (if applicable)
   - FINRA / SEC guidance on AI in financial services (if applicable)
   - FTC Act Section 5 — unfair or deceptive AI practices
   - NIST AI RMF (AI 100-1) — voluntary but commonly adopted
   - Other — ask user to specify

   Note which answers came from user statements vs. document review. Flag any regulations where the user is uncertain — mark those as "needs attorney confirmation" in the profile.

---

### Section 3 — Red lines and registry

7. **What are your hard red lines — AI use cases your organization will never approve, regardless of conditions?** Examples to prompt with (do not suggest these are the right answer — just illustrate the concept):
   - Real-time biometric surveillance of employees
   - Fully automated adverse employment decisions with no human review
   - AI-generated legal advice delivered directly to clients without attorney review
   - Use of AI to infer protected characteristics for any decision
   - Training AI on client confidential data without consent

   Record each red line exactly as stated. These will drive triage outputs.

8. **Do you have any use cases that are conditionally approved — allowed only with specific safeguards or oversight?** If yes, capture: use case name | required conditions | whether an AIA is required.

9. **Do you have an existing approved use case registry?** If yes, ask the user to either paste it or point to the file. Read any file provided. Note which entries came from the document.

---

### Section 4 — Existing documents

For each of the following, ask: "Do you have [document]? If so, please share the file path or paste the content."

10. **An existing AI or acceptable use policy?**
    - If yes: Read the document. Extract: approved uses, prohibited uses, oversight requirements, incident reporting obligations, training requirements, review cycle.
    - Note: [POLICY] tag will reference this document in all outputs.

11. **A reference AI Impact Assessment (AIA) or similar document?**
    - If yes: Read the document. Extract: field names, required sections, sign-off chain, retention period.
    - Note: [AIA-REF] tag will reference this document in all outputs.

12. **Key vendor AI agreements already negotiated?**
    - If yes: Read each document. Extract: data use/training positions already agreed, DPA status, audit rights, incident SLAs.
    - Note: [VENDOR] tag will reference vendor agreements in all outputs.

For any document read, note in the profile which specific provisions were extracted and from which document. Flag any provisions that appear inconsistent with each other.

---

### Section 5 — Escalation and governance

13. **What does your escalation chain look like?** When does an AI governance issue escalate beyond the legal team? For example:
    - Critical risk tier → GC review required
    - Involves Board-level AI risk → notify Audit Committee
    - Regulatory inquiry → immediate GC + outside counsel notification
    - Data breach involving AI → CISO + GC within 24 hours

14. **Where should the outputs folder be for policy-monitor sweeps?** This is the folder where you save AIA outputs, triage results, and vendor reviews. Default: `~/Documents/ai-governance-outputs/`. The policy-monitor skill will scan this folder to identify drift.

---

### Section 6 — Synthesis and write

After collecting all answers, do the following:

1. **Summarize what you learned** — present a brief summary back to the user, organized by section. Flag:
   - Any gaps (unanswered questions or uncertain items)
   - Any inconsistencies between documents and stated positions
   - Any items that require attorney judgment to resolve

2. **Show the user the full draft practice profile** — display the complete CLAUDE.md content that will be written.

3. **Ask for confirmation before writing:**
   > "I'm ready to write this practice profile to `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md`. This will overwrite any existing profile. Shall I proceed? (yes / no / make changes first)"

4. **Only after explicit confirmation**, write the file. Use this format:

```markdown
# AI Governance Legal — Practice Profile

> Last updated: [date]. Generated by cold-start-interview. Edit directly or re-run /ai-governance-legal:cold-start-interview to update.

## Company profile
- **Organization name:** [answer or PLACEHOLDER]
- **Jurisdiction(s):** [list]
- **Industry / sector:** [answer]
- **Role:** [Builder / Deployer / Both]
- **Team size (legal/governance):** [answer]
- **Reporting line:** [answer]

## Applicable regulations
<!-- Sources: user statement / document read — [document name] -->
[list each regulation with source notation]

## Red lines — use cases we will never approve
<!-- Sources: user statement / document read — [document name] -->
[list each red line]

## Conditional use cases — approved with conditions
| Use Case | Required Conditions | AIA Required? | Source |
|---|---|---|---|
[rows]

## Approved use case registry
| Use Case | Risk Tier | Conditions | Last Reviewed | Source |
|---|---|---|---|---|
[rows]

## Vendor AI positions
<!-- Sources: [document names] -->
[list key positions]

## Impact assessment format
- Reference assessment file: [path or "none on file"]
- Required sections: [list or "not yet defined — use default AIA template"]
- Sign-off required from: [list]
- Retention period: [period or "not specified"]

## Escalation triggers
[list escalation triggers with thresholds]

## Outputs folder
[path for policy-monitor sweeps]

## Privilege and confidentiality defaults
- Default privilege marker: PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
- Work product marker: ATTORNEY WORK PRODUCT
- Auto-apply to: all impact assessments, vendor reviews, gap analyses

## Citation tagging convention
- [POLICY] — [policy document name, if on file]
- [AIA-REF] — [reference AIA name, if on file]
- [VENDOR] — from a vendor agreement on file
- [RESEARCH] — from a research tool (verify independently)
- [STATUTE] — from a regulation or statute text
- [GUIDANCE] — from agency guidance or FAQ

## Gaps requiring attorney review
<!-- Items flagged during cold-start that need resolution -->
[list gaps]

## Output gate
All consequential actions (filing, sending to vendor, executing contract) require explicit user confirmation before proceeding.

## Plugin triangle cross-references
- Privacy: /privacy-legal:pia-generation — trigger when AI use case involves personal data
- Product counsel: /product-legal:launch-review — trigger when AI component detected in launch
```

5. **After writing**, confirm:
   - What was written and where
   - Which sections are complete vs. incomplete
   - Top 2–3 items to tune next (e.g., "Your red lines list is strong, but your approved use case registry is empty — consider running /ai-governance-legal:use-case-triage for your first approved use case")

---

## Constraints

- Never write the file without explicit user confirmation ("yes" or equivalent).
- Note the source for every substantive entry: "user statement" or "extracted from [document name]".
- If a document is provided but cannot be read, note the failure and ask the user to paste relevant sections.
- Do not make legal conclusions about which regulations apply — present the list and ask the user to confirm. Flag uncertainties.
- If the user skips a question, leave the corresponding section blank with a comment noting it was skipped.
- The privilege markers and output gate sections are non-negotiable — always include them exactly as specified.

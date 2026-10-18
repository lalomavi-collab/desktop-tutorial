# AI governance records

Working copies of the files written by the `ai-governance-legal` cold-start interview (started 2026-10-18). The plugin reads them from `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/`, which lives outside the repository and is lost when a cloud session ends. These copies are the durable record.

- `practice-profile.md`: the practice profile (CLAUDE.md in the plugin config). Paused at Part 4; sections marked `[PENDING]` are not yet answered.
- `ai-systems.yaml`: the AI system inventory. 1 of 14 systems classified (sys-001, provider, limited risk). The other 13 were found by a code scan and still need classification.

To resume, copy both files back to the plugin config path and run `/ai-governance-legal:cold-start-interview`.
Positions are stated by the owner, not a reviewed policy. Legal references are tagged `[verify]`.

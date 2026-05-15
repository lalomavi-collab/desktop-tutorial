# Intake Templates

Default intake templates are embedded in `/legal-clinic:client-intake/skill.md`.

To create custom templates for your clinic's practice areas, run:

```
/legal-clinic:build-guide [practice area]
```

The professor's intake templates, uploaded at cold-start, are stored here:

```
references/intake-templates/
├── immigration.md      # Custom — if uploaded
├── housing.md          # Custom — if uploaded
├── family-law.md       # Custom — if uploaded
├── consumer.md         # Custom — if uploaded
├── criminal.md         # Custom — if uploaded
└── civil-rights.md     # Custom — if uploaded
```

If no custom template exists for a practice area, `/client-intake` uses the default questions in `skill.md`.

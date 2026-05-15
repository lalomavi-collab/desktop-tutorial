# Client Communications Logs

Append-only per-case communication records managed by `/legal-clinic:client-comms-log`.

## Structure

```
client-comms/
└── [case-id]/
    └── log.md     # Append-only chronological log for this case
```

## Usage

To add a communication entry:

```
/legal-clinic:client-comms-log [case-id] add
```

To view a case log:

```
/legal-clinic:client-comms-log [case-id] view
```

## What goes here

- Phone calls (date, time, participants, brief summary, follow-up)
- Emails (date, to/from, brief summary)
- Letters sent or received (date, type, brief summary)
- In-person meetings (date, participants, brief summary)
- Voicemails and texts (if clinic policy permits logging)

## What does NOT go here

- Substantive legal analysis → case file and `/memo`
- Draft documents → clinic file system
- Attorney work product → case file

## Confidentiality

Logs are `PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION`.
File names use case IDs only — no client-identifying information in folder or file names.
Entries are append-only and are not edited or deleted after logging.

Manage the Telegram-Claude Code bridge for this session.

Arguments: $ARGUMENTS

---

Handle the following subcommands:

**`pair <CODE>`**
Complete the Telegram pairing by running:
```
python -m telegram.pair <CODE> claude-code
```
Report success (paired chat ID + session name) or failure (invalid/expired code).
After success, remind the user that Telegram messages will now be dispatched via GitHub Actions.

**`status`**
Show current bridge status by running:
```
python -m telegram.pair status
```
Display the number of pending codes and active sessions.

**`unpair`**
Remove all sessions by running:
```
python -m telegram.pair unpair
```
Confirm how many sessions were removed.

**No arguments / `help`**
Explain the bridge:
- The Telegram bot sends a 6-char code when someone DMs it.
- Running `/telegram:access pair <CODE>` here links this session to that Telegram chat.
- After pairing, messages from that chat are dispatched as GitHub Actions `repository_dispatch` events.
- The workflow `telegram-message.yml` writes them to `telegram/messages/` for processing.

Execute the appropriate action now using the Bash tool.

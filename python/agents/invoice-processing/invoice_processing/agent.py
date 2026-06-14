"""Invoice Processing Agent — root agent definition."""
from google.adk.agents import Agent
from dotenv import load_dotenv
load_dotenv()

from invoice_processing.collectors.email_collector import collect_from_emails
from invoice_processing.collectors.folder_collector import collect_from_folder
from invoice_processing.collectors.accounting_notifier import (
    prepare_accounting_email,
    send_accounting_email,
)

root_agent = Agent(
    name="invoice_processing_agent",
    model="gemini-2.0-flash",
    description="Collects invoices from email and local folders, then prepares accounting summaries.",
    instruction=(
        "You are an invoice processing assistant. "
        "You can collect invoices from two IMAP mailboxes or from the local month folder, "
        "prepare a summary email draft for accounting, and send it only after explicit user confirmation."
    ),
    tools=[
        collect_from_emails,
        collect_from_folder,
        prepare_accounting_email,
        send_accounting_email,
    ],
)

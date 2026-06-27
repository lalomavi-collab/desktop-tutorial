"""
NotebookLM MCP Server
Exposes NotebookLM capabilities as Claude tools:
  1. enrich_from_notebook  - pull insights from a notebook to enrich a conversation
  2. create_marketing_asset - generate audio/video/quiz from an idea
  3. save_to_brain          - save a conversation summary to the "second brain" notebook
  4. list_notebooks         - list all notebooks
  5. ask_notebook           - ask a question directly to a notebook
"""

import asyncio
import os
import sys
from typing import Optional

# FastMCP makes it simple to expose Python functions as MCP tools
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("mcp package not found. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

try:
    from notebooklm import NotebookLMClient
except ImportError:
    print("notebooklm-py not found. Run: pip install 'notebooklm-py[browser]'", file=sys.stderr)
    sys.exit(1)

mcp = FastMCP("NotebookLM")

SECOND_BRAIN_NAME = "המוח שלי"  # default second-brain notebook title


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _get_client() -> NotebookLMClient:
    return await NotebookLMClient.from_storage().__aenter__()


async def _find_notebook(client: NotebookLMClient, name: str) -> Optional[str]:
    notebooks = await client.notebooks.list()
    for nb in notebooks:
        if nb.title == name:
            return nb.id
    return None


# ---------------------------------------------------------------------------
# Tool 1 – List notebooks
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_notebooks() -> str:
    """List all NotebookLM notebooks with their IDs and titles."""
    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        if not notebooks:
            return "No notebooks found."
        lines = [f"- [{nb.id}] {nb.title}" for nb in notebooks]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool 2 – Enrich conversation from notebook
# ---------------------------------------------------------------------------

@mcp.tool()
async def enrich_from_notebook(notebook_name: str, question: str) -> str:
    """
    Pull relevant insights from a NotebookLM notebook to enrich the current
    conversation.

    Args:
        notebook_name: The title of the notebook to query (e.g. "סיכומי פגישות").
        question: The specific question or instruction (e.g. "מה שלושת הדברים הכי חשובים?").

    Returns:
        The notebook's answer as a string.
    """
    async with await NotebookLMClient.from_storage() as client:
        nb_id = await _find_notebook(client, notebook_name)
        if nb_id is None:
            return f"Notebook '{notebook_name}' not found. Use list_notebooks() to see available notebooks."
        result = await client.chat.ask(nb_id, question)
        return result.answer


# ---------------------------------------------------------------------------
# Tool 3 – Create marketing asset
# ---------------------------------------------------------------------------

@mcp.tool()
async def create_marketing_asset(
    notebook_name: str,
    asset_type: str = "audio",
    instructions: str = "",
    save_path: str = "",
) -> str:
    """
    Generate a marketing asset (audio podcast, video, quiz, mind map) from a
    notebook's content – without spending extra tokens.

    Args:
        notebook_name: Notebook that holds the idea/content.
        asset_type: One of "audio", "video", "quiz", "mind_map".
        instructions: Optional style/language instructions (e.g. "בעברית, קצר ועניני").
        save_path: Local path to save the downloaded file (optional).

    Returns:
        Status message with download path or task ID.
    """
    async with await NotebookLMClient.from_storage() as client:
        nb_id = await _find_notebook(client, notebook_name)
        if nb_id is None:
            return f"Notebook '{notebook_name}' not found."

        asset_type = asset_type.lower()

        if asset_type == "audio":
            status = await client.artifacts.generate_audio(nb_id, instructions=instructions or None)
        elif asset_type == "video":
            status = await client.artifacts.generate_video(nb_id, instructions=instructions or None)
        elif asset_type == "quiz":
            status = await client.artifacts.generate_quiz(nb_id)
        elif asset_type == "mind_map":
            result = await client.artifacts.generate_mind_map(nb_id)
            if save_path:
                await client.artifacts.download_mind_map(nb_id, save_path)
                return f"Mind map saved to {save_path}"
            return f"Mind map generated (task id: {result.task_id if hasattr(result, 'task_id') else 'done'})"
        else:
            return f"Unknown asset_type '{asset_type}'. Choose from: audio, video, quiz, mind_map."

        # Wait for async generation to complete
        await client.artifacts.wait_for_completion(nb_id, status.task_id)

        if save_path:
            if asset_type == "audio":
                await client.artifacts.download_audio(nb_id, save_path)
            elif asset_type == "video":
                await client.artifacts.download_video(nb_id, save_path)
            elif asset_type == "quiz":
                await client.artifacts.download_quiz(nb_id, save_path, output_format="json")
            return f"{asset_type.capitalize()} asset saved to {save_path}"

        return f"{asset_type.capitalize()} asset generation complete (task_id={status.task_id})."


# ---------------------------------------------------------------------------
# Tool 4 – Save summary to second brain
# ---------------------------------------------------------------------------

@mcp.tool()
async def save_to_brain(summary: str, notebook_name: str = SECOND_BRAIN_NAME) -> str:
    """
    Save a conversation summary or insight to the 'second brain' notebook.
    Creates the notebook automatically if it does not exist.

    Args:
        summary: Text to save (markdown supported).
        notebook_name: Target notebook title (defaults to "המוח שלי").

    Returns:
        Confirmation message.
    """
    async with await NotebookLMClient.from_storage() as client:
        nb_id = await _find_notebook(client, notebook_name)
        if nb_id is None:
            nb = await client.notebooks.create(notebook_name)
            nb_id = nb.id

        # Add the summary as a text source
        await client.sources.add_text(nb_id, summary, title=f"סיכום {_today()}", wait=True)
        return f"Summary saved to notebook '{notebook_name}' (id={nb_id})."


# ---------------------------------------------------------------------------
# Tool 5 – Ask notebook (direct Q&A)
# ---------------------------------------------------------------------------

@mcp.tool()
async def ask_notebook(notebook_name: str, question: str) -> str:
    """
    Ask a free-form question to a NotebookLM notebook and get an answer.

    Args:
        notebook_name: The notebook to query.
        question: Your question.

    Returns:
        The notebook's answer.
    """
    return await enrich_from_notebook(notebook_name, question)


# ---------------------------------------------------------------------------
# Util
# ---------------------------------------------------------------------------

def _today() -> str:
    from datetime import date
    return date.today().isoformat()


if __name__ == "__main__":
    mcp.run()

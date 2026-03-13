"""פורמט פלט - utilities"""

from prompt_builder.templates.app_templates import DomainTemplate


def format_domain_list(domains: dict[str, DomainTemplate]) -> str:
    """מציג רשימת תחומים זמינים"""
    lines = ["תחומים מקצועיים זמינים:", ""]
    for i, (key, domain) in enumerate(domains.items(), 1):
        lines.append(f"  {i}. {domain.display_name:<25} - {domain.description}")
    return "\n".join(lines)

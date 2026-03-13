"""דוגמה: בניית פרומפט לאפליקציה משפטית - ללא API"""

from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.templates.app_templates import ALL_DOMAINS
from prompt_builder.utils.formatter import format_domain_list


def example_legal_prompt():
    """
    דוגמה: בניית פרומפט לכלי ניתוח חוזי נדל"ן
    כפי שמתואר ב-6 השלבים.
    """
    print("=" * 70)
    print("דוגמה: בניית פרומפט משפטי ב-6 שלבים (ללא API)")
    print("=" * 70)
    print()

    # הצגת תחומים זמינים
    print(format_domain_list(ALL_DOMAINS))
    print()

    # יצירת סוכן
    agent = PromptBuilderAgent.__new__(PromptBuilderAgent)
    agent.conversation = []
    agent.answers = {}
    agent.current_step_idx = 0
    agent.follow_ups_asked = set()
    agent.client = None
    agent.project_name = "ניתוח חוזי נדל\"ן"

    # בחירת תחום משפטי
    agent.domain = ALL_DOMAINS["legal"]
    print(f"תחום שנבחר: {agent.domain.display_name}")
    print(f"תיאור: {agent.domain.description}")
    print()

    # מילוי 6 השלבים
    print("--- שלב 1: תפקיד ---")
    agent.save_answer("role", "עורך דין מומחה להתחדשות עירונית")
    print(f"  ✓ {agent.answers['role']}")

    print("--- שלב 2: קהל יעד ---")
    agent.save_answer("audience", "לקוח הקליניקה")
    print(f"  ✓ {agent.answers['audience']}")

    print("--- שלב 3: נתונים ---")
    agent.save_answer("input_context", "קובץ החוזה המצורף")
    print(f"  ✓ {agent.answers['input_context']}")

    print("--- שלב 4: משימה ---")
    agent.save_answer("task", "לייצר סיכום סיכונים")
    print(f"  ✓ {agent.answers['task']}")

    print("--- שלב 5: אילוצים ---")
    agent.save_answer("constraints", "שפה ברורה שאינה משפטית מורכבת")
    print(f"  ✓ {agent.answers['constraints']}")

    print("--- שלב 6: מבנה פלט ---")
    agent.save_answer("output_structure", "טבלה המורכבת משלוש עמודות: סיכון, משמעות כספית, והמלצה לביצוע")
    print(f"  ✓ {agent.answers['output_structure']}")

    print()

    # יצירת One-liner
    print("=" * 70)
    print("📝 פרומפט בשורה אחת:")
    print("=" * 70)
    one_liner = agent.generate_one_liner()
    print(one_liner)
    print()

    # יצירת פרומפט מלא
    print("=" * 70)
    print("📄 פרומפט מלא:")
    print("=" * 70)
    full_prompt = agent.generate_prompt()
    print(full_prompt)


def example_education_prompt():
    """דוגמה: בניית פרומפט לכלי חינוכי"""
    print("=" * 70)
    print("דוגמה: בניית פרומפט לקורס אקדמי")
    print("=" * 70)
    print()

    agent = PromptBuilderAgent.__new__(PromptBuilderAgent)
    agent.conversation = []
    agent.answers = {}
    agent.current_step_idx = 0
    agent.follow_ups_asked = set()
    agent.client = None
    agent.project_name = "עוזר הוראה לקורס משפט חוקתי"

    agent.domain = ALL_DOMAINS["education"]

    agent.save_answer("role", "מרצה אקדמי למשפט חוקתי")
    agent.save_answer("audience", "סטודנטים לתואר ראשון במשפטים")
    agent.save_answer("input_context", "סילבוס הקורס ופסקי דין מנחים")
    agent.save_answer("task", "בניית מערך שיעור לנושא חופש הביטוי")
    agent.save_answer("constraints", "שיעור של 90 דקות, כולל דיון כיתתי")
    agent.save_answer("output_structure", "מערך שיעור מובנה: פתיחה (15 דק), הרצאה (30 דק), ניתוח פסק דין (25 דק), דיון (15 דק), סיכום (5 דק)")

    one_liner = agent.generate_one_liner()
    print("📝 פרומפט בשורה אחת:")
    print(one_liner)
    print()

    full_prompt = agent.generate_prompt()
    print("📄 פרומפט מלא:")
    print(full_prompt)


if __name__ == "__main__":
    example_legal_prompt()
    print("\n\n")
    example_education_prompt()

"""דוגמה: בניית פרומפט גנרי ב-6 שלבים - ללא API"""

from prompt_builder.templates.app_templates import PromptSession
from prompt_builder.utils.formatter import format_steps_overview


def example_legal():
    """דוגמה: פרומפט לכלי ניתוח חוזי נדל"ן"""
    print("=" * 70)
    print("דוגמה 1: ניתוח חוזי נדל\"ן (תחום משפטי)")
    print("=" * 70)
    print()

    # הצגת 6 השלבים
    print(format_steps_overview())
    print()

    # יצירת סשן
    session = PromptSession(
        project_name="ניתוח חוזי נדל\"ן",
        domain="משפטי - התחדשות עירונית",
        platform="אפליקציית ווב",
    )

    # מילוי 6 השלבים
    session.answers = {
        "role": "עורך דין מומחה להתחדשות עירונית",
        "audience": "לקוח הקליניקה - שפה פשוטה וברורה",
        "input_context": "קובץ החוזה המצורף (PDF)",
        "task": "לייצר סיכום סיכונים עם המלצות",
        "constraints": "שפה ברורה שאינה משפטית מורכבת, התייחסות לחוק המכר",
        "output_structure": "טבלה: סיכון | משמעות כספית | המלצה לביצוע",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


def example_education():
    """דוגמה: פרומפט לעוזר הוראה"""
    print("=" * 70)
    print("דוגמה 2: עוזר הוראה (תחום חינוך)")
    print("=" * 70)
    print()

    session = PromptSession(
        project_name="עוזר הוראה לקורס משפט חוקתי",
        domain="חינוך אקדמי",
        platform="בוט בטלגרם",
    )

    session.answers = {
        "role": "מרצה אקדמי למשפט חוקתי",
        "audience": "סטודנטים לתואר ראשון במשפטים",
        "input_context": "סילבוס הקורס ופסקי דין מנחים",
        "task": "בניית מערך שיעור לנושא חופש הביטוי",
        "constraints": "שיעור של 90 דקות, כולל דיון כיתתי",
        "output_structure": "מערך שיעור: פתיחה (15 דק), הרצאה (30 דק), ניתוח פסק דין (25 דק), דיון (15 דק), סיכום (5 דק)",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


def example_fitness():
    """דוגמה: פרומפט לאפליקציית כושר - תחום שלא קיים כתבנית קשיחה"""
    print("=" * 70)
    print("דוגמה 3: אפליקציית כושר אישי (תחום כושר/בריאות)")
    print("=" * 70)
    print()

    session = PromptSession(
        project_name="מאמן כושר אישי AI",
        domain="כושר ותזונה",
        platform="אפליקציית מובייל",
    )

    session.answers = {
        "role": "מאמן כושר אישי מוסמך עם 10 שנות ניסיון",
        "audience": "מתאמנים מתחילים בגילאי 25-45",
        "input_context": "שאלון בריאות ראשוני + יעדי המתאמן + ציוד זמין",
        "task": "בניית תוכנית אימונים שבועית מותאמת אישית",
        "constraints": "אימונים של 30-45 דקות, 3-4 פעמים בשבוע, ללא ציוד יקר, כולל disclaimer רפואי",
        "output_structure": "לוח שבועי עם: יום | שם אימון | תרגילים (סטים x חזרות) | זמן | רמת מאמץ",
    }

    print("📝 פרומפט בשורה אחת:")
    print(session.generate_one_liner())
    print()
    print("📄 פרומפט מלא:")
    print(session.generate_full_prompt())


if __name__ == "__main__":
    example_legal()
    print("\n")
    example_education()
    print("\n")
    example_fitness()

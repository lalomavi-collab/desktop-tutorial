"""דוגמה בסיסית לשימוש בסוכן בניית הפרומפטים"""

from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.agents.quick_build import quick_build
from prompt_builder.templates.app_templates import ALL_TEMPLATES
from prompt_builder.utils.formatter import format_template_list


def example_manual_build():
    """דוגמה לבנייה ידנית של פרומפט ללא API"""
    print("=" * 60)
    print("דוגמה 1: בנייה ידנית (ללא Claude API)")
    print("=" * 60)

    # הצגת תבניות זמינות
    print(format_template_list(ALL_TEMPLATES))
    print()

    # יצירת סוכן ובחירת תבנית
    agent = PromptBuilderAgent.__new__(PromptBuilderAgent)
    agent.conversation = []
    agent.answers = {}
    agent.current_section_idx = 0
    agent.template = ALL_TEMPLATES["web_app"]
    agent.client = None

    # מילוי תשובות
    agent.answers["project_name"] = "מערכת ניהול משימות"
    agent.save_answer("סקירה כללית", "אפליקציית ווב לניהול משימות צוותיות עם תמיכה ב-Kanban")
    agent.save_answer("קהל יעד", "צוותי פיתוח קטנים עד בינוניים (5-20 אנשים)")
    agent.save_answer("טכנולוגיות", "React + TypeScript, Node.js + Express, PostgreSQL")
    agent.save_answer("פיצ'רים עיקריים", """
- יצירה וניהול משימות עם תגיות ועדיפויות
- לוח Kanban עם drag & drop
- הקצאת משימות לחברי צוות
- תצוגת Timeline / Gantt
- התראות בזמן אמת
- חיפוש וסינון מתקדם
""")
    agent.save_answer("מודל נתונים", """
- User: id, name, email, role
- Team: id, name, members[]
- Task: id, title, description, status, priority, assignee, due_date
- Board: id, name, columns[], team_id
""")
    agent.save_answer("API Endpoints", """
- POST /api/tasks - יצירת משימה
- GET /api/tasks - רשימת משימות (עם סינון)
- PUT /api/tasks/:id - עדכון משימה
- GET /api/boards/:id - טעינת לוח
- WebSocket /ws - עדכונים בזמן אמת
""")
    agent.save_answer("אימות והרשאות", "JWT + OAuth2 (Google), roles: admin, member, viewer")
    agent.save_answer("UI/UX", "Material Design, Dark mode support, Responsive")

    # יצירת הפרומפט
    prompt = agent.generate_prompt()
    print(prompt)


def example_quick_build():
    """דוגמה לבנייה מהירה עם Claude API"""
    print("=" * 60)
    print("דוגמה 2: בנייה מהירה (דורש ANTHROPIC_API_KEY)")
    print("=" * 60)

    try:
        prompt = quick_build(
            description="אפליקציית ניהול מתכונים עם חיפוש לפי מרכיבים",
            app_type="web_app",
        )
        print(prompt)
    except Exception as e:
        print(f"שגיאה (נדרש API key): {e}")


if __name__ == "__main__":
    example_manual_build()
    print("\n" + "=" * 60 + "\n")
    example_quick_build()

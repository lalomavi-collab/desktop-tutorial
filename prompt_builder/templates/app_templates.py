"""תבניות פרומפטים לסוגי אפליקציות שונים"""

from dataclasses import dataclass, field


@dataclass
class AppSection:
    """חלק בודד בפרומפט"""
    title: str
    description: str
    content: str = ""
    required: bool = True


@dataclass
class AppTemplate:
    """תבנית פרומפט לסוג אפליקציה"""
    name: str
    description: str
    sections: list[AppSection] = field(default_factory=list)


# --- תבניות מוכנות ---

WEB_APP_TEMPLATE = AppTemplate(
    name="web_app",
    description="אפליקציית ווב (Frontend + Backend)",
    sections=[
        AppSection(
            title="סקירה כללית",
            description="תיאור כללי של האפליקציה, המטרה שלה והבעיה שהיא פותרת",
        ),
        AppSection(
            title="קהל יעד",
            description="מי המשתמשים? מה הצרכים שלהם?",
        ),
        AppSection(
            title="טכנולוגיות",
            description="סטאק טכנולוגי: Frontend framework, Backend, Database, etc.",
        ),
        AppSection(
            title="פיצ'רים עיקריים",
            description="רשימת הפיצ'רים המרכזיים של האפליקציה",
        ),
        AppSection(
            title="מודל נתונים",
            description="ישויות מרכזיות וקשרים ביניהן",
        ),
        AppSection(
            title="API Endpoints",
            description="נקודות קצה מרכזיות של ה-API",
        ),
        AppSection(
            title="אימות והרשאות",
            description="מנגנון Login, roles, permissions",
        ),
        AppSection(
            title="UI/UX",
            description="עמודים מרכזיים, ניווט, עיצוב כללי",
        ),
    ],
)

API_SERVICE_TEMPLATE = AppTemplate(
    name="api_service",
    description="שירות API / Microservice",
    sections=[
        AppSection(
            title="סקירה כללית",
            description="מטרת השירות והתפקיד שלו בארכיטקטורה",
        ),
        AppSection(
            title="טכנולוגיות",
            description="שפה, Framework, Database, Message Queue, etc.",
        ),
        AppSection(
            title="API Contract",
            description="Endpoints, Request/Response schemas, status codes",
        ),
        AppSection(
            title="מודל נתונים",
            description="סכמת Database, ישויות וקשרים",
        ),
        AppSection(
            title="אינטגרציות",
            description="שירותים חיצוניים, APIs של צד שלישי",
        ),
        AppSection(
            title="ביצועים ו-Scaling",
            description="דרישות ביצועים, caching, rate limiting",
        ),
        AppSection(
            title="אבטחה",
            description="Authentication, Authorization, validation",
        ),
        AppSection(
            title="ניטור ולוגים",
            description="Logging, monitoring, alerting",
            required=False,
        ),
    ],
)

MOBILE_APP_TEMPLATE = AppTemplate(
    name="mobile_app",
    description="אפליקציית מובייל (iOS / Android / Cross-platform)",
    sections=[
        AppSection(
            title="סקירה כללית",
            description="תיאור האפליקציה והבעיה שהיא פותרת",
        ),
        AppSection(
            title="פלטפורמה",
            description="iOS, Android, Cross-platform (React Native / Flutter)?",
        ),
        AppSection(
            title="קהל יעד",
            description="מי המשתמשים והצרכים שלהם",
        ),
        AppSection(
            title="פיצ'רים עיקריים",
            description="יכולות מרכזיות של האפליקציה",
        ),
        AppSection(
            title="מסכים וניווט",
            description="מסכים מרכזיים, flow של המשתמש",
        ),
        AppSection(
            title="Backend ונתונים",
            description="API, אחסון מקומי, סנכרון",
        ),
        AppSection(
            title="יכולות מכשיר",
            description="מצלמה, GPS, notifications, offline support",
            required=False,
        ),
        AppSection(
            title="עיצוב",
            description="סגנון עיצוב, צבעים, Design System",
            required=False,
        ),
    ],
)

CLI_TOOL_TEMPLATE = AppTemplate(
    name="cli_tool",
    description="כלי שורת פקודה (CLI)",
    sections=[
        AppSection(
            title="סקירה כללית",
            description="מטרת הכלי ומה הוא עושה",
        ),
        AppSection(
            title="טכנולוגיה",
            description="שפת תכנות וספריות",
        ),
        AppSection(
            title="פקודות",
            description="רשימת הפקודות והפרמטרים",
        ),
        AppSection(
            title="קלט ופלט",
            description="פורמטים של קלט (files, stdin) ופלט (stdout, files)",
        ),
        AppSection(
            title="קונפיגורציה",
            description="קבצי הגדרות, environment variables",
            required=False,
        ),
    ],
)

AUTOMATION_TEMPLATE = AppTemplate(
    name="automation",
    description="סקריפט אוטומציה / Pipeline",
    sections=[
        AppSection(
            title="סקירה כללית",
            description="מה התהליך שצריך לאטמט?",
        ),
        AppSection(
            title="טריגרים",
            description="מה מפעיל את התהליך? (schedule, event, manual)",
        ),
        AppSection(
            title="שלבים",
            description="רשימת השלבים בתהליך, בסדר כרונולוגי",
        ),
        AppSection(
            title="אינטגרציות",
            description="מערכות חיצוניות שהתהליך מתקשר איתן",
        ),
        AppSection(
            title="טיפול בשגיאות",
            description="מה קורה כשמשהו נכשל? retries, notifications",
        ),
    ],
)


ALL_TEMPLATES: dict[str, AppTemplate] = {
    t.name: t
    for t in [
        WEB_APP_TEMPLATE,
        API_SERVICE_TEMPLATE,
        MOBILE_APP_TEMPLATE,
        CLI_TOOL_TEMPLATE,
        AUTOMATION_TEMPLATE,
    ]
}

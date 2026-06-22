# LAWLINK — Professional Social Network for Attorneys Only

> **LAWLINK** הוא שם המותג של המוצר. `LDR` (Legal Decision Room) משמש כשם-קוד פנימי
> וכקידומת לסכמת מסד הנתונים (`ldr_*`).

פלטפורמה שיתופית לעורכי דין המשלבת **חכמת המונים מקצועית (Peer Review)** עם **בינה מלאכותית** לניהול
סיכונים משפטיים-כלכליים, סימולציות טקטיות ויישוב סכסוכים מונחה-הכרעה (DOM).

> ⚠️ זהו **שלד תשתית (infrastructure skeleton)** מוכן ל-deploy דרך Skaffold / Cloud Code על Kubernetes.
> הוא פונקציונלי מקצה-לקצה ברמת ה-API, אך מנועי ה-AI/NER מסומנים כ-`# TODO` להחלפה במימוש production.

## 🔐 עקרון העל: גבול ה-Zero-Knowledge

הקו האדום של המוצר הוא **שחיסיון עו"ד–לקוח נשמר מוחלט**. לכן:

```
┌─────────────────────────── מכשיר הלקוח (CLIENT) ───────────────────────────┐
│  client-anonymizer/  —  השחרת ישויות (NER) + ערבול סכומים → אובייקט נקי     │
└────────────────────────────────────┬───────────────────────────────────────┘
                                      │  (רק אובייקט אנונימי חוצה את הגבול)
══════════════════════ גבול ה-Zero-Knowledge ══════════════════════════════════
                                      │
┌────────────────────────── הענן (Kubernetes) ───────────────────────────────┐
│  services/ingestion  → סיווג + Risk Vector                                  │
│  services/peer-room  → חדר החלטות אנונימי (הצבעות עמיתים)                    │
│  services/ai-core    → מנוע סיכון (מאזינה → מציעה → אוטונומית)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**מנוע האנונימיזציה רץ אך ורק בצד הלקוח.** שום שירות בענן לא מקבל טקסט גולמי. שירות ה-Ingestion
אף כולל *PII tripwire* הדוחה payload שנראה כמכיל מזהים גולמיים (הגנת עומק).

## 🗂️ מודל הנתונים (The LDR Schema)

המקור הקנוני: [`schema/ldr_case.schema.json`](schema/ldr_case.schema.json).
משוקף ב-TypeScript ([`client-anonymizer/src/schema.ts`](client-anonymizer/src/schema.ts))
וב-Pydantic ([`services/ingestion/app/models.py`](services/ingestion/app/models.py)).

| שדה | סוג | תפקיד |
|---|---|---|
| `case_id` | UUID | מזהה אנונימי ייחודי |
| `legal_domain` | Enum | תחום (`Real_Estate_TAMA38`, `Commercial_Dispute`, ...) |
| `economic_exposure` | Range Enum | שווי כלכלי כטווח (`10M_to_15M`) — לעולם לא ערך גולמי |
| `risk_factors` | Array | כשלים מזוהים (`regulatory_delay`, `funding_gap`) |
| `proposed_strategy` | Text (Cleaned) | המתווה, נקי מזהויות |
| `peer_predictions` | Array[Object] | הצבעות עמיתים |
| `ai_insights` | Object | תובנות AI + Risk Score |

## 🚀 הרצה דרך Cloud Code / Skaffold

```bash
# מתוך IDE: Cloud Code → "Run on Kubernetes"
# או מ-CLI:
skaffold dev          # פיתוח רציף עם hot-reload
skaffold run          # deploy חד-פעמי

kubectl get pods -n ldr
```

## 📦 שכבות ורפליקציה

| שכבה | Workload | רפליקציה |
|---|---|---|
| ingestion | `Deployment` + `HPA` | אופקית, חסר-מצב |
| ai-core | `Deployment` + `HPA` | אופקית, חסר-מצב |
| peer-room | `Deployment` | אופקית, חסר-מצב |
| postgres | `StatefulSet` | primary + persistence (לא `replicas` גנרי) |

## מבנה התיקיות

```
ldr/
  schema/                 # מקור אמת קנוני ל-LDR Schema
  client-anonymizer/      # ספריית TS — גבול ה-Zero-Knowledge (client-side)
  services/
    ingestion/            # FastAPI — קליטה, סיווג, Risk Vector
    ai-core/              # FastAPI — מנוע Risk Score
    peer-room/            # FastAPI — חדר החלטות אנונימי
  k8s/                    # manifests
  skaffold.yaml
```

# Subtitle tracks of the home page film, one WebVTT file per site language, timed from WORK/narration.json.
# Each paragraph is one cue, or several where the text carries a "|" split (time shared by length).
# English is the narration. Hebrew is the owner's language; Spanish, French and Arabic are drafts for native review
# before they go live (the same review the other new strings wait for). No dashes as punctuation.
# Writes public/media/home-film.<lang>.vtt.
import json, os

WORK = os.environ.get("WORK", "/tmp/tts-home")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "media")
narr = json.load(open(os.path.join(WORK, "narration.json")))
order = ["1", "2", "3", "4", "5"]
off, acc = {}, 0.0
for n in order:
    off[n] = acc
    acc += narr[n]["dur"]

T = {  # five scenes, paragraphs in order
 "en": [["AI you can defend.", "Because the work moves fast, and someone still has to answer for it."],
        ["AI and law is the axis of the firm: | advisory, ongoing accompaniment, and training | for organizations adopting artificial intelligence.", "From usage policy, to audit, to documentation."],
        ["The engine runs inside your practice.", "It audits exposure as the work happens, | automates the routine, | and keeps a documented trail on every decision.", "And it puts the sharp calls back where they belong: with the lawyer."],
        ["That is the Clinic: advisory, ongoing accompaniment, and training.", "Real questions, answered by a person."],
        ["Eight questions. Two minutes. Then we talk.", "Start at lalumapp.com."]],
 "he": [["AI שאפשר להגן עליו.", "כי העבודה זזה מהר, ועדיין מישהו צריך לענות עליה."],
        ["AI ומשפט הם הציר של המשרד: | ייעוץ, ליווי שוטף והדרכה | לארגונים שמאמצים בינה מלאכותית.", "ממדיניות שימוש, דרך ביקורת, ועד תיעוד."],
        ["המנוע פועל בתוך הפרקטיקה שלך.", "הוא בודק חשיפה תוך כדי העבודה, | מאוטמט את השגרה, | ושומר תיעוד על כל החלטה.", "ומחזיר את ההכרעות החדות למקומן: אל עורך הדין."],
        ["זו הקליניקה: ייעוץ, ליווי שוטף והדרכה.", "שאלות אמיתיות, שעונה עליהן אדם."],
        ["שמונה שאלות. שתי דקות. ואז נדבר.", "מתחילים ב-lalumapp.com."]],
 "es": [["IA que puedes defender.", "Porque el trabajo avanza rápido, y alguien tiene que responder por él."],
        ["La IA y el derecho son el eje del despacho: | asesoría, acompañamiento continuo y formación | para organizaciones que adoptan inteligencia artificial.", "Desde la política de uso, pasando por la auditoría, hasta la documentación."],
        ["El motor funciona dentro de tu práctica.", "Audita la exposición mientras se trabaja, | automatiza lo rutinario | y deja un registro documentado de cada decisión.", "Y devuelve las decisiones críticas a quien corresponden: al abogado."],
        ["Esa es la Clínica: asesoría, acompañamiento continuo y formación.", "Preguntas reales, respondidas por una persona."],
        ["Ocho preguntas. Dos minutos. Y luego hablamos.", "Empieza en lalumapp.com."]],
 "fr": [["Une IA que vous pouvez défendre.", "Parce que le travail va vite, et que quelqu'un doit encore en répondre."],
        ["L'IA et le droit sont l'axe du cabinet : | conseil, accompagnement continu et formation | pour les organisations qui adoptent l'intelligence artificielle.", "De la politique d'usage à l'audit, jusqu'à la documentation."],
        ["Le moteur fonctionne au sein de votre pratique.", "Il audite l'exposition pendant que le travail se fait, | automatise le routinier | et conserve une trace documentée de chaque décision.", "Et il remet les décisions tranchantes à leur place : chez l'avocat."],
        ["Voilà la Clinique : conseil, accompagnement continu et formation.", "De vraies questions, traitées par une personne."],
        ["Huit questions. Deux minutes. Puis nous parlons.", "Commencez sur lalumapp.com."]],
 "ar": [["ذكاء اصطناعي يمكنك الدفاع عنه.", "لأن العمل يتحرك بسرعة، وما زال على أحد أن يتحمل مسؤوليته."],
        ["الذكاء الاصطناعي والقانون هما محور المكتب: | استشارة ومرافقة مستمرة وتدريب | للمؤسسات التي تعتمد الذكاء الاصطناعي.", "من سياسة الاستخدام، مرورًا بالتدقيق، وحتى التوثيق."],
        ["المحرك يعمل داخل ممارستك.", "يدقق في التعرض للمخاطر أثناء العمل، | ويؤتمت الروتين، | ويحتفظ بسجل موثق لكل قرار.", "ويعيد القرارات الحاسمة إلى موضعها: عند المحامي."],
        ["هذه هي العيادة: استشارة ومرافقة مستمرة وتدريب.", "أسئلة حقيقية، يجيب عنها إنسان."],
        ["ثمانية أسئلة. دقيقتان. ثم نتحدث.", "ابدأ على lalumapp.com."]],
}


def ts(s):
    ms = int(round(s * 1000))
    return "%02d:%02d:%02d.%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)


for lang, scenes in T.items():
    lines = ["WEBVTT", ""]
    for n, paras in zip(order, scenes):
        assert len(paras) == len(narr[n]["paras"]), (lang, n)
        for p, text in zip(narr[n]["paras"], paras):
            parts = [x.strip() for x in text.split("|")]
            a, b = off[n] + p["a"] - .05, off[n] + p["b"] + .25
            tot = sum(len(x) for x in parts)
            cur = a
            for x in parts:
                d = (b - a) * len(x) / tot
                lines += [f"{ts(cur)} --> {ts(cur + d)}", x, ""]
                cur += d
    open(os.path.join(OUT, f"home-film.{lang}.vtt"), "w", encoding="utf-8").write("\n".join(lines))
print("tracks written", list(T), "for", round(acc, 1), "s")

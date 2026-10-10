"""AYUSH (Ayurveda) structured assessment definitions.

Fields are *documentation prompts*, not a scoring system. No scoring, weighting or
diagnostic rule is implemented, because none has been clinically validated for JivSetu.
`audience` controls who may write a field: "patient" fields can be answered by the patient,
"practitioner" fields only by authorised staff.
"""
from typing import Any

LANGS = ("en", "hi", "mr")
PRAKRITI_SUGGESTIONS = ["Vata", "Pitta", "Kapha", "Vata-Pitta", "Pitta-Kapha", "Vata-Kapha", "Tridoshaja"]


def _f(key: str, audience: str, en: str, hi: str, mr: str, suggestions: list[str] | None = None) -> dict[str, Any]:
    field: dict[str, Any] = {"key": key, "audience": audience, "label": {"en": en, "hi": hi, "mr": mr}}
    if suggestions:
        field["suggestions"] = suggestions
    return field


P, D = "patient", "practitioner"

MODULES: dict[str, dict[str, Any]] = {
    "trividha": {
        "title": {"en": "Trividha Pariksha", "hi": "त्रिविध परीक्षा", "mr": "त्रिविध परीक्षा"},
        "instructions": {
            "en": "Answer in your own words. Skip anything you are unsure about.",
            "hi": "अपने शब्दों में उत्तर दें। जिसके बारे में निश्चित न हों उसे छोड़ दें।",
            "mr": "तुमच्या शब्दांत उत्तर द्या. ज्याबद्दल खात्री नसेल ते सोडा.",
        },
        "fields": [
            _f("darshana", D, "Darshana (inspection)", "दर्शन (निरीक्षण)", "दर्शन (निरीक्षण)"),
            _f("sparshana", D, "Sparshana (palpation / touch)", "स्पर्शन (स्पर्श परीक्षा)", "स्पर्शन (स्पर्श परीक्षा)"),
            _f("prashna_complaints", P, "Your main complaints and for how long", "आपकी मुख्य शिकायतें और कितने समय से", "तुमच्या मुख्य तक्रारी आणि किती काळापासून"),
            _f("prashna_appetite", P, "Appetite and digestion", "भूख और पाचन", "भूक आणि पचन"),
            _f("prashna_sleep", P, "Sleep", "नींद", "झोप"),
            _f("prashna_bowel", P, "Bowel habits", "मल त्याग की आदतें", "शौचाची सवय"),
            _f("prashna_urine", P, "Urination habits", "मूत्र त्याग की आदतें", "लघवीची सवय"),
            _f("prashna_thirst_energy", P, "Thirst and energy levels", "प्यास और ऊर्जा", "तहान आणि ऊर्जा"),
        ],
    },
    "ashtavidha": {
        "title": {"en": "Ashtavidha Pariksha", "hi": "अष्टविध परीक्षा", "mr": "अष्टविध परीक्षा"},
        "instructions": {
            "en": "Practitioner examination findings.",
            "hi": "चिकित्सक की जाँच के निष्कर्ष।",
            "mr": "वैद्यांच्या तपासणीचे निष्कर्ष.",
        },
        "fields": [
            _f("nadi", D, "Nadi (pulse)", "नाडी (नब्ज़)", "नाडी (नाडी परीक्षा)"),
            _f("mala", D, "Mala (stool)", "मल", "मल"),
            _f("mutra", D, "Mutra (urine)", "मूत्र", "मूत्र"),
            _f("jihva", D, "Jihva (tongue)", "जिह्वा (जीभ)", "जिव्हा (जीभ)"),
            _f("shabda", D, "Shabda (voice / sounds)", "शब्द (आवाज़)", "शब्द (आवाज)"),
            _f("sparsha", D, "Sparsha (touch / skin)", "स्पर्श (त्वचा)", "स्पर्श (त्वचा)"),
            _f("drik", D, "Drik (eyes / vision)", "दृक् (नेत्र)", "दृक् (नेत्र)"),
            _f("aakriti", D, "Aakriti (build / form)", "आकृति (शारीरिक बनावट)", "आकृती (शारीरिक बांधा)"),
        ],
    },
    "dashavidha": {
        "title": {"en": "Dashavidha Pariksha", "hi": "दशविध परीक्षा", "mr": "दशविध परीक्षा"},
        "instructions": {
            "en": "Practitioner assessment. Two items can also be described by the patient.",
            "hi": "चिकित्सक का मूल्यांकन। दो बिंदु रोगी भी बता सकते हैं।",
            "mr": "वैद्यांचे मूल्यांकन. दोन मुद्दे रुग्णही सांगू शकतो.",
        },
        "fields": [
            _f("prakriti", D, "Prakriti (constitution)", "प्रकृति", "प्रकृती", PRAKRITI_SUGGESTIONS),
            _f("vikriti", D, "Vikriti (current imbalance)", "विकृति", "विकृती", PRAKRITI_SUGGESTIONS),
            _f("sara", D, "Sara (tissue quality)", "सार", "सार"),
            _f("samhanana", D, "Samhanana (body compactness)", "संहनन", "संहनन"),
            _f("pramana", D, "Pramana (body measurements)", "प्रमाण", "प्रमाण"),
            _f("satmya", D, "Satmya (habitual suitability)", "सात्म्य", "सात्म्य"),
            _f("satva", D, "Satva (mental strength)", "सत्त्व", "सत्त्व"),
            _f("ahara_shakti", P, "Ahara Shakti (how much you can eat and digest)", "आहार शक्ति (कितना खा और पचा सकते हैं)", "आहार शक्ती (किती खाऊ आणि पचवू शकता)"),
            _f("vyayama_shakti", P, "Vyayama Shakti (how much exercise you can do)", "व्यायाम शक्ति (कितना व्यायाम कर सकते हैं)", "व्यायाम शक्ती (किती व्यायाम करू शकता)"),
            _f("vaya", D, "Vaya (age group)", "वय", "वय"),
        ],
    },
}

MAX_VALUE_LENGTH = 1000


def field_keys(module: str, audience: str | None = None) -> list[str]:
    return [f["key"] for f in MODULES[module]["fields"] if audience is None or f["audience"] == audience]


def schema_for(role: str) -> dict[str, Any]:
    """Patients are only shown the fields they may answer."""
    out: dict[str, Any] = {}
    for name, module in MODULES.items():
        fields = [f for f in module["fields"] if role != "patient" or f["audience"] == "patient"]
        if fields:
            out[name] = {**module, "fields": fields}
    return out


def completion_status(module: str, data: dict[str, str], audience: str | None = None) -> str:
    """'completed' when every field in scope has an answer; otherwise 'incomplete'."""
    keys = field_keys(module, audience)
    return "completed" if keys and all((data.get(k) or "").strip() for k in keys) else "incomplete"

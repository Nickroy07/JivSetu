import type { Language } from "@/lib/i18n";

export type QuestionInputType =
  | "choice"
  | "text"
  | "number"
  | "yesNo";

export interface ClinicalOption {
  id: string;
  label: Record<Language, string>;
}

export interface ClinicalQuestion {
  id: string;
  section: string;
  inputType: QuestionInputType;
  question: Record<Language, string>;
  helpText?: Record<Language, string>;
  options?: ClinicalOption[];
  required?: boolean;
}

export const clinicalQuestions: ClinicalQuestion[] = [
  {
    id: "chief_complaint",
    section: "Chief Complaint",
    inputType: "choice",
    required: true,
    question: {
      en: "What brings you to the hospital today?",
      hi: "आज आप अस्पताल क्यों आए हैं?",
      mr: "आज तुम्ही रुग्णालयात का आला आहात?",
    },
    helpText: {
      en: "You can speak or choose an option.",
      hi: "आप बोल सकते हैं या कोई विकल्प चुन सकते हैं।",
      mr: "तुम्ही बोलू शकता किंवा एखादा पर्याय निवडू शकता.",
    },
    options: [
      {
        id: "chest_pain",
        label: {
          en: "Chest pain",
          hi: "सीने में दर्द",
          mr: "छातीत दुखणे",
        },
      },
      {
        id: "fever",
        label: {
          en: "Fever",
          hi: "बुखार",
          mr: "ताप",
        },
      },
      {
        id: "breathing",
        label: {
          en: "Breathing difficulty",
          hi: "सांस लेने में कठिनाई",
          mr: "श्वास घेण्यास त्रास",
        },
      },
      {
        id: "pain",
        label: {
          en: "Other pain",
          hi: "अन्य दर्द",
          mr: "इतर वेदना",
        },
      },
      {
        id: "follow_up",
        label: {
          en: "Follow-up visit",
          hi: "फॉलो-अप विज़िट",
          mr: "फॉलो-अप भेट",
        },
      },
      {
        id: "other",
        label: {
          en: "Something else",
          hi: "कुछ और",
          mr: "काहीतरी वेगळे",
        },
      },
    ],
  },

  {
    id: "symptom_onset",
    section: "History of Present Illness",
    inputType: "text",
    required: true,
    question: {
      en: "Since when have you had this problem?",
      hi: "यह समस्या कब से है?",
      mr: "ही समस्या केव्हापासून आहे?",
    },
    helpText: {
      en: "For example: since yesterday, for 3 days, for 2 weeks.",
      hi: "उदाहरण: कल से, 3 दिन से, 2 हफ़्ते से।",
      mr: "उदाहरण: कालपासून, 3 दिवसांपासून, 2 आठवड्यांपासून.",
    },
  },

  {
    id: "symptom_description",
    section: "History of Present Illness",
    inputType: "text",
    question: {
      en: "Describe the problem in your own words.",
      hi: "अपनी समस्या अपने शब्दों में बताइए।",
      mr: "तुमची समस्या तुमच्या शब्दांत सांगा.",
    },
    helpText: {
      en: "What do you feel, what makes it better or worse?",
      hi: "आपको क्या महसूस होता है, किससे आराम या तकलीफ़ बढ़ती है?",
      mr: "तुम्हाला काय जाणवते, कशाने बरे किंवा वाईट वाटते?",
    },
  },

  {
    id: "chest_pain_onset",
    section: "History of Present Illness",
    inputType: "text",
    required: true,
    question: {
      en: "When did the chest pain start?",
      hi: "सीने में दर्द कब शुरू हुआ?",
      mr: "छातीत दुखणे कधी सुरू झाले?",
    },
    helpText: {
      en: "For example: today morning, 2 hours ago, or yesterday.",
      hi: "उदाहरण: आज सुबह, 2 घंटे पहले या कल।",
      mr: "उदाहरण: आज सकाळी, २ तासांपूर्वी किंवा काल.",
    },
  },

  {
    id: "chest_pain_location",
    section: "History of Present Illness",
    inputType: "choice",
    required: true,
    question: {
      en: "Where do you feel the chest pain?",
      hi: "सीने में दर्द कहाँ महसूस होता है?",
      mr: "छातीत दुखणे कुठे जाणवते?",
    },
    options: [
      {
        id: "center",
        label: {
          en: "Centre of the chest",
          hi: "सीने के बीच में",
          mr: "छातीच्या मध्यभागी",
        },
      },
      {
        id: "left",
        label: {
          en: "Left side",
          hi: "बाईं ओर",
          mr: "डाव्या बाजूला",
        },
      },
      {
        id: "right",
        label: {
          en: "Right side",
          hi: "दाईं ओर",
          mr: "उजव्या बाजूला",
        },
      },
      {
        id: "other",
        label: {
          en: "Somewhere else",
          hi: "कहीं और",
          mr: "इतर ठिकाणी",
        },
      },
    ],
  },

  {
    id: "chest_pain_character",
    section: "History of Present Illness",
    inputType: "choice",
    required: true,
    question: {
      en: "How would you describe the chest pain?",
      hi: "आप सीने के दर्द का वर्णन कैसे करेंगे?",
      mr: "छातीत होणाऱ्या वेदनेचे वर्णन कसे कराल?",
    },
    options: [
      {
        id: "pressure",
        label: {
          en: "Pressure or heaviness",
          hi: "दबाव या भारीपन",
          mr: "दाब किंवा जडपणा",
        },
      },
      {
        id: "sharp",
        label: {
          en: "Sharp",
          hi: "तेज़ / चुभने वाला",
          mr: "तीक्ष्ण / टोचणारे",
        },
      },
      {
        id: "burning",
        label: {
          en: "Burning",
          hi: "जलन",
          mr: "जळजळ",
        },
      },
      {
        id: "other",
        label: {
          en: "Something else",
          hi: "कुछ और",
          mr: "काहीतरी वेगळे",
        },
      },
    ],
  },

  {
    id: "chest_pain_severity",
    section: "History of Present Illness",
    inputType: "choice",
    required: true,
    question: {
      en: "How severe is the pain?",
      hi: "दर्द कितना तेज़ है?",
      mr: "वेदना किती तीव्र आहे?",
    },
    options: [
      {
        id: "mild",
        label: {
          en: "Mild",
          hi: "हल्का",
          mr: "सौम्य",
        },
      },
      {
        id: "moderate",
        label: {
          en: "Moderate",
          hi: "मध्यम",
          mr: "मध्यम",
        },
      },
      {
        id: "severe",
        label: {
          en: "Severe",
          hi: "बहुत तेज़",
          mr: "तीव्र",
        },
      },
    ],
  },

  {
    id: "chest_pain_radiation",
    section: "History of Present Illness",
    inputType: "choice",
    required: true,
    question: {
      en: "Does the pain spread anywhere else?",
      hi: "क्या दर्द कहीं और फैलता है?",
      mr: "वेदना इतर ठिकाणी पसरते का?",
    },
    options: [
      {
        id: "none",
        label: {
          en: "No",
          hi: "नहीं",
          mr: "नाही",
        },
      },
      {
        id: "arm",
        label: {
          en: "Arm",
          hi: "बांह",
          mr: "हात",
        },
      },
      {
        id: "back",
        label: {
          en: "Back",
          hi: "पीठ",
          mr: "पाठ",
        },
      },
      {
        id: "jaw",
        label: {
          en: "Jaw",
          hi: "जबड़ा",
          mr: "जबडा",
        },
      },
      {
        id: "other",
        label: {
          en: "Somewhere else",
          hi: "कहीं और",
          mr: "इतर ठिकाणी",
        },
      },
    ],
  },

  {
    id: "chest_pain_aggravating",
    section: "History of Present Illness",
    inputType: "text",
    question: {
      en: "What makes the chest pain worse?",
      hi: "सीने का दर्द किस चीज़ से बढ़ता है?",
      mr: "छातीत होणारी वेदना कशामुळे वाढते?",
    },
  },

  {
    id: "chest_pain_relief",
    section: "History of Present Illness",
    inputType: "text",
    question: {
      en: "What makes the chest pain better?",
      hi: "सीने का दर्द किस चीज़ से कम होता है?",
      mr: "छातीत होणारी वेदना कशामुळे कमी होते?",
    },
  },

  {
    id: "breathlessness",
    section: "Review of Systems",
    inputType: "yesNo",
    required: true,
    question: {
      en: "Have you had any difficulty breathing?",
      hi: "क्या आपको सांस लेने में कठिनाई हुई है?",
      mr: "तुम्हाला श्वास घेण्यास त्रास झाला आहे का?",
    },
  },

  {
    id: "sweating",
    section: "Review of Systems",
    inputType: "yesNo",
    required: true,
    question: {
      en: "Have you experienced unusual sweating?",
      hi: "क्या आपको असामान्य पसीना आया है?",
      mr: "तुम्हाला असामान्य घाम आला आहे का?",
    },
  },

  {
    id: "nausea",
    section: "Review of Systems",
    inputType: "yesNo",
    required: true,
    question: {
      en: "Have you felt nauseated or sick?",
      hi: "क्या आपको मतली या उल्टी जैसा महसूस हुआ है?",
      mr: "तुम्हाला मळमळ किंवा उलटीसारखे वाटले आहे का?",
    },
  },

  {
    id: "diabetes",
    section: "Past Medical History",
    inputType: "yesNo",
    required: true,
    question: {
      en: "Have you ever been diagnosed with diabetes?",
      hi: "क्या आपको कभी मधुमेह का निदान हुआ है?",
      mr: "तुम्हाला कधी मधुमेहाचे निदान झाले आहे का?",
    },
  },

  {
    id: "medications",
    section: "Drug History",
    inputType: "text",
    question: {
      en: "What medicines are you currently taking?",
      hi: "आप अभी कौन-कौन सी दवाइयाँ लेते हैं?",
      mr: "तुम्ही सध्या कोणती औषधे घेत आहात?",
    },
  },

  {
    id: "allergies",
    section: "Allergy History",
    inputType: "text",
    question: {
      en: "Do you have any known medicine or other allergies?",
      hi: "क्या आपको किसी दवा या अन्य चीज़ से एलर्जी है?",
      mr: "तुम्हाला कोणत्याही औषधाची किंवा इतर गोष्टीची ऍलर्जी आहे का?",
    },
  },

  {
    id: "family_history",
    section: "Family History",
    inputType: "text",
    question: {
      en: "Is there anything important about your family's medical history?",
      hi: "क्या आपके परिवार के चिकित्सा इतिहास में कुछ महत्वपूर्ण है?",
      mr: "तुमच्या कौटुंबिक वैद्यकीय इतिहासात काही महत्त्वाचे आहे का?",
    },
  },

  {
    id: "personal_history",
    section: "Personal History",
    inputType: "text",
    question: {
      en: "Is there anything about your daily habits or personal history that you would like to tell us?",
      hi: "क्या आपकी दैनिक आदतों या व्यक्तिगत इतिहास के बारे में कुछ बताना चाहते हैं?",
      mr: "तुमच्या दैनंदिन सवयी किंवा वैयक्तिक इतिहासाबद्दल काही सांगायचे आहे का?",
    },
  },
];
export type Language = "en" | "hi" | "mr";

export const translations = {
  en: {
    welcome: "Welcome to Jivsetu",
    description:
      "A digital patient case-taking system designed to help healthcare teams capture comprehensive clinical history efficiently.",
    patient: "Patient",
    doctor: "Doctor",
    patientDescription:
      "Start your digital case-taking process using voice, touch, or text.",
    doctorDescription:
      "Access the clinical dashboard, patient queue, histories, documents, alerts, and verification tools.",
    startPatientVisit: "Start Patient Visit",
    doctorLogin: "Doctor Login",
    voiceEnabled: "Voice enabled",
    touchFriendly: "Touch friendly",
    accessibilityFocused: "Accessibility focused",
    securePatientCare: "Secure Patient Care",
    aiAssisted: "AI-assisted • Human verified",
    back: "Back",
    medikiosk: "MediKiosk",
    feelingQuestion: "Let's understand how you are feeling",
    patientInstruction:
      "You can speak, type, or tap your answers. You can also listen to every question.",
    informationImportant: "Your information is important",
    patientInformation:
      "We will ask questions about your health and medical history to prepare information for your healthcare professional.",
    start: "Start",
    selectLanguage: "Select language",
  },

  hi: {
    welcome: "Jivsetu में आपका स्वागत है",
    description:
      "एक डिजिटल रोगी केस-टेकिंग सिस्टम जो स्वास्थ्य सेवा टीमों को व्यापक चिकित्सीय इतिहास कुशलतापूर्वक दर्ज करने में सहायता करता है।",
    patient: "मरीज़",
    doctor: "डॉक्टर",
    patientDescription:
      "आवाज़, टच या टेक्स्ट का उपयोग करके अपनी डिजिटल केस-टेकिंग प्रक्रिया शुरू करें।",
    doctorDescription:
      "क्लिनिकल डैशबोर्ड, रोगी कतार, इतिहास, दस्तावेज़, अलर्ट और सत्यापन उपकरणों तक पहुँच प्राप्त करें।",
    startPatientVisit: "रोगी की विज़िट शुरू करें",
    doctorLogin: "डॉक्टर लॉगिन",
    voiceEnabled: "आवाज़ उपलब्ध",
    touchFriendly: "टच के लिए सुविधाजनक",
    accessibilityFocused: "सुलभता पर केंद्रित",
    securePatientCare: "सुरक्षित रोगी देखभाल",
    aiAssisted: "AI-सहायता • मानव द्वारा सत्यापित",
    back: "वापस",
    medikiosk: "MediKiosk",
    feelingQuestion: "आइए समझते हैं कि आप कैसा महसूस कर रहे हैं",
    patientInstruction:
      "आप बोल सकते हैं, टाइप कर सकते हैं या अपने उत्तर पर टैप कर सकते हैं। आप हर प्रश्न को सुन भी सकते हैं।",
    informationImportant: "आपकी जानकारी महत्वपूर्ण है",
    patientInformation:
      "हम आपके स्वास्थ्य और चिकित्सा इतिहास के बारे में प्रश्न पूछेंगे ताकि आपके स्वास्थ्य सेवा पेशेवर के लिए जानकारी तैयार की जा सके।",
    start: "शुरू करें",
    selectLanguage: "भाषा चुनें",
  },

  mr: {
    welcome: "Jivsetu मध्ये आपले स्वागत आहे",
    description:
      "रुग्णांचा सविस्तर वैद्यकीय इतिहास कार्यक्षमपणे नोंदविण्यास आरोग्यसेवा टीमला मदत करणारी डिजिटल केस-टेकिंग प्रणाली.",
    patient: "रुग्ण",
    doctor: "डॉक्टर",
    patientDescription:
      "आवाज, टच किंवा टेक्स्ट वापरून तुमची डिजिटल केस-टेकिंग प्रक्रिया सुरू करा.",
    doctorDescription:
      "क्लिनिकल डॅशबोर्ड, रुग्णांची रांग, इतिहास, कागदपत्रे, अलर्ट आणि पडताळणी साधनांमध्ये प्रवेश मिळवा.",
    startPatientVisit: "रुग्णाची भेट सुरू करा",
    doctorLogin: "डॉक्टर लॉगिन",
    voiceEnabled: "आवाजाची सुविधा",
    touchFriendly: "टचसाठी सोयीचे",
    accessibilityFocused: "सुलभतेवर केंद्रित",
    securePatientCare: "सुरक्षित रुग्णसेवा",
    aiAssisted: "AI-सहाय्यित • मानवाने पडताळलेले",
    back: "मागे",
    medikiosk: "MediKiosk",
    feelingQuestion: "तुम्हाला कसे वाटत आहे हे समजून घेऊया",
    patientInstruction:
      "तुम्ही बोलू शकता, टाइप करू शकता किंवा उत्तरावर टॅप करू शकता. तुम्ही प्रत्येक प्रश्न ऐकूही शकता.",
    informationImportant: "तुमची माहिती महत्त्वाची आहे",
    patientInformation:
      "तुमच्या आरोग्याबद्दल आणि वैद्यकीय इतिहासाबद्दल आम्ही प्रश्न विचारू, जेणेकरून तुमच्या आरोग्यसेवा व्यावसायिकासाठी माहिती तयार करता येईल.",
    start: "सुरू करा",
    selectLanguage: "भाषा निवडा",
  },
} as const;

export function getTranslations(language: Language) {
  return translations[language];
}
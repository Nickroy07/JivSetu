export const APP_NAME = "Jivsetu";

export const APP_MODULE = "MediKiosk";

export const TAGLINE = "People • Care • Connected";

export const HOSPITAL_NAME = "Janseva District Government Hospital";

export const HOSPITAL_NAME_HI = "जनसेवा जिला सरकारी अस्पताल";

export const HOSPITAL_NAME_MR = "जनसेवा जिल्हा सरकारी रुग्णालय";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
  },
] as const;

export const USER_ROLES = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin",
} as const;
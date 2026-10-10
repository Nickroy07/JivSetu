"use client";

import { useEffect, useState } from "react";

/* ---------------------------------------------------------------
   Staff session: localStorage (survives refresh, cleared on sign-out
   or when the API returns 401). Patient session: sessionStorage
   (ends when the kiosk tab closes).
---------------------------------------------------------------- */

export interface StaffSession {
  token: string;
  userId: string;
  role: string;
  displayName: string;
  expiresAt: number;
}

export interface PatientSession {
  token: string;
  patientId: number;
  visitId: number;
  name: string;
  mobile: string;
}

export interface PendingVerification {
  name: string;
  mobile: string;
  delivery: "sms" | "development";
  devOtp?: string;
  sentAt: number;
}

const STAFF_KEY = "jivsetu.staff";
const PATIENT_KEY = "jivsetu.patient";

function read<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — session lives in memory only */
  }
}

const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);
const ss = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function getStaffSession(): StaffSession | null {
  const s = read<StaffSession>(ls(), STAFF_KEY);
  if (s && s.expiresAt > Date.now()) return s;
  if (s) write(ls(), STAFF_KEY, null);
  return null;
}
export const setStaffSession = (s: StaffSession | null) => write(ls(), STAFF_KEY, s);

export const getPatientSession = () => read<PatientSession>(ss(), PATIENT_KEY);
export function setPatientSession(s: PatientSession | null) {
  write(ss(), PATIENT_KEY, s);
}

export function clearPatientFlow() {
  const store = ss();
  if (!store) return;
  Object.keys(store)
    .filter((k) => k.startsWith("jivsetu"))
    .forEach((k) => store.removeItem(k));
}

/** Draft persistence so recoverable errors never lose typed input. */
export const loadDraft = <T,>(key: string) => read<T>(ss(), `jivsetu.draft.${key}`);
export const saveDraft = (key: string, value: unknown) => write(ss(), `jivsetu.draft.${key}`, value);
export const clearDraft = (key: string) => write(ss(), `jivsetu.draft.${key}`, null);

export const loadLocalDraft = <T,>(key: string) => read<T>(ls(), `jivsetu.draft.${key}`);
export const saveLocalDraft = (key: string, value: unknown) => write(ls(), `jivsetu.draft.${key}`, value);
export const clearLocalDraft = (key: string) => write(ls(), `jivsetu.draft.${key}`, null);

/** Read a browser-only value after mount (avoids hydration mismatches). */
export function useClientValue<T>(reader: () => T): { value: T | null; ready: boolean } {
  const [state, setState] = useState<{ value: T | null; ready: boolean }>({ value: null, ready: false });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    setState({ value: reader(), ready: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

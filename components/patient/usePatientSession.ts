"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setUnauthorizedHandler } from "@/lib/api";
import { PatientSession, clearPatientFlow, getPatientSession } from "@/lib/session";

/** Returns the patient session, redirecting to the start if there is none. */
export function usePatientSession() {
  const router = useRouter();
  const [session, setSession] = useState<PatientSession | null>(null);

  useEffect(() => {
    const s = getPatientSession();
    if (!s) {
      router.replace("/patient?expired=1");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage once
    setSession(s);
    setUnauthorizedHandler(() => {
      clearPatientFlow();
      router.replace("/patient?expired=1");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return session;
}

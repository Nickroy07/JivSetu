"use client";

import { Nfc, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import Alert from "@/components/ui/Alert";
import Button, { LinkButton } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { api, errorMessage } from "@/lib/api";
import { nfcReader, qrCameraReader, type IdentifierReader } from "@/lib/identifier";
import { setPatientSession } from "@/lib/session";

const COPY = {
  en: { title: "Sign in with your card or QR code", body: "Scan your JivSetu card or QR code. We will then send a code to your registered mobile number to confirm it is you.", qr: "Scan QR code", nfc: "Tap card", manual: "Use mobile number instead", cardCode: "Card code", send: "Continue", otp: "Enter the code sent to", verify: "Verify", scanning: "Scanning… hold the code in front of the camera.", unsupported: "This device cannot scan automatically. Enter the card code or use your mobile number.", cancel: "Cancel" },
  hi: { title: "कार्ड या QR कोड से साइन इन करें", body: "अपना JivSetu कार्ड या QR कोड स्कैन करें। फिर आपके पंजीकृत मोबाइल पर पुष्टि के लिए एक कोड भेजा जाएगा।", qr: "QR कोड स्कैन करें", nfc: "कार्ड टैप करें", manual: "इसके बजाय मोबाइल नंबर का उपयोग करें", cardCode: "कार्ड कोड", send: "आगे बढ़ें", otp: "भेजा गया कोड दर्ज करें:", verify: "सत्यापित करें", scanning: "स्कैन हो रहा है… कोड को कैमरे के सामने रखें।", unsupported: "यह डिवाइस अपने आप स्कैन नहीं कर सकता। कार्ड कोड दर्ज करें या मोबाइल नंबर का उपयोग करें।", cancel: "रद्द करें" },
  mr: { title: "कार्ड किंवा QR कोडने साइन इन करा", body: "तुमचे JivSetu कार्ड किंवा QR कोड स्कॅन करा. त्यानंतर तुमच्या नोंदणीकृत मोबाइलवर खात्रीसाठी कोड पाठवला जाईल.", qr: "QR कोड स्कॅन करा", nfc: "कार्ड टॅप करा", manual: "त्याऐवजी मोबाइल नंबर वापरा", cardCode: "कार्ड कोड", send: "पुढे जा", otp: "पाठवलेला कोड टाका:", verify: "सत्यापित करा", scanning: "स्कॅन होत आहे… कोड कॅमेऱ्यासमोर धरा.", unsupported: "हे डिव्हाइस आपोआप स्कॅन करू शकत नाही. कार्ड कोड टाका किंवा मोबाइल नंबर वापरा.", cancel: "रद्द करा" },
} as const;

interface ScanResponse { masked_mobile: string; delivery: "sms" | "development"; dev_otp?: string }
interface VerifyResponse { access_token: string; patient_id: number; visit_id: number; mobile: string; name: string }

export default function ScanPage() {
  return (
    <PatientShell>
      <Scan />
    </PatientShell>
  );
}

function Scan() {
  const { lang } = usePatientLang();
  const t = COPY[lang];
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [sent, setSent] = useState<ScanResponse | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState({ qr: false, nfc: false });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run in the browser
    setCaps({ qr: qrCameraReader(() => null).available(), nfc: nfcReader.available() });
    return () => abort.current?.abort(); // stop camera / NFC when leaving the page
  }, []);

  async function identify(raw: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ScanResponse>("/identifiers/scan", { json: { token: raw } });
      setToken(raw);
      setSent(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function run(reader: IdentifierReader) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setScanning(true);
    setError(null);
    try {
      await identify(await reader.scan(ctl.signal));
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") setError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<VerifyResponse>("/identifiers/verify", { json: { token, otp } });
      setPatientSession({ token: res.access_token, patientId: res.patient_id, visitId: res.visit_id, name: res.name, mobile: res.mobile });
      router.push("/patient/consent");
    } catch (err) {
      setError(errorMessage(err));
      setOtp("");
      setLoading(false);
    }
  }

  return (
    <div className="animate-rise">
      <PatientHeading title={t.title} body={t.body} />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {!sent ? (
        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="xl" disabled={!caps.qr || scanning} onClick={() => run(qrCameraReader(() => video.current))}><QrCode className="size-5" aria-hidden /> {t.qr}</Button>
            <Button size="xl" disabled={!caps.nfc || scanning} onClick={() => run(nfcReader)}><Nfc className="size-5" aria-hidden /> {t.nfc}</Button>
          </div>
          {!caps.qr && !caps.nfc && <p className="text-sm text-slate-600">{t.unsupported}</p>}
          <video ref={video} playsInline muted className={scanning && caps.qr ? "w-full rounded-lg bg-black" : "hidden"} />
          {scanning && (
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span role="status">{t.scanning}</span>
              <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>{t.cancel}</Button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (token.trim()) identify(token.trim()); }} className="flex gap-2">
            <Input aria-label={t.cardCode} placeholder={t.cardCode} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <Button type="submit" loading={loading} disabled={token.trim().length < 8}>{t.send}</Button>
          </form>
        </Card>
      ) : (
        <Card className="p-5">
          {sent.delivery === "development" && sent.dev_otp && (
            <Alert tone="warning" className="mb-4">Development mode: no SMS was sent. Code: <b className="tnum font-mono">{sent.dev_otp}</b></Alert>
          )}
          <form onSubmit={verify} className="space-y-4">
            <label className="block text-[17px] text-slate-800">{t.otp} <b className="tnum">{sent.masked_mobile}</b>
              <Input className="mt-2 text-center text-2xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            </label>
            <Button type="submit" size="xl" className="w-full" loading={loading} disabled={otp.length < 4}>{t.verify}</Button>
          </form>
        </Card>
      )}

      <LinkButton href="/patient/register" variant="outline" size="lg" className="mt-6 w-full">{t.manual}</LinkButton>
    </div>
  );
}

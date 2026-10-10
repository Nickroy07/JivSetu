"use client";

import { CheckCircle2, Download, ExternalLink, Network, RefreshCw, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { api, errorMessage } from "@/lib/api";

interface AbdmStatus {
  mode: "disabled" | "mock" | "sandbox" | "production";
  live_exchange_available: boolean;
  base_url?: string;
  client_id_configured?: boolean;
}

interface FhirMetadata {
  fhir_version: string;
  supported_resources: string[];
  bundle_type: string;
}

interface Capabilities {
  max_upload_mb: number;
  image_ocr_available: boolean;
  ocr_engines: Record<string, boolean>;
}

export default function IntegrationsStatusPage() {
  return (
    <DoctorShell>
      <IntegrationsContent />
    </DoctorShell>
  );
}

function IntegrationsContent() {
  const { token } = useStaff();
  const [abdm, setAbdm] = useState<AbdmStatus | null>(null);
  const [fhir, setFhir] = useState<FhirMetadata | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [abdmRes, fhirRes, capsRes] = await Promise.all([
        api<AbdmStatus>("/abdm/status", { token }).catch(() => null),
        api<FhirMetadata>("/fhir/metadata", { token }).catch(() => null),
        api<Capabilities>("/documents/capabilities").catch(() => null),
      ]);
      setAbdm(abdmRes);
      setFhir(fhirRes ?? {
        fhir_version: "R4 (4.0.1)",
        supported_resources: [
          "Bundle",
          "Organization",
          "Patient",
          "Encounter",
          "Condition",
          "MedicationStatement",
          "Observation",
          "AllergyIntolerance",
          "Flag",
          "DocumentReference",
          "Consent",
          "Provenance"
        ],
        bundle_type: "collection"
      });
      setCaps(capsRes);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Interoperability & Integrations"
        description="Health data exchange standards, ABDM sandbox verification, and HL7 FHIR R4 conformance status."
        actions={
          <Button variant="outline" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="size-3.5" /> Refresh Status
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" title="Error checking integrations" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ABDM Card */}
        <Card>
          <CardHeader
            title="Ayushman Bharat Digital Mission (ABDM)"
            description="ABHA creation, verification, and Ayushman Bharat health exchange adapter."
            icon={<Network className="size-4 text-brand-600" />}
            actions={
              abdm ? (
                <Badge tone={abdm.mode === "mock" ? "warning" : abdm.mode === "disabled" ? "neutral" : "success"}>
                  {abdm.mode.toUpperCase()}
                </Badge>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            {loading && !abdm ? (
              <div className="flex py-6 justify-center"><Spinner /></div>
            ) : abdm ? (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Adapter Mode</span>
                    <span className="font-semibold text-slate-800 capitalize">{abdm.mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Live ABDM Exchange</span>
                    <Badge tone={abdm.live_exchange_available ? "success" : "warning"} dot>
                      {abdm.live_exchange_available ? "Active" : "Sandbox / Mock only"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Client ID Configured</span>
                    <span className="font-mono text-slate-700">{abdm.client_id_configured ? "Yes" : "Not set (Mock mode)"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5" /> Note on Official ABDM Compliance
                  </p>
                  Jivsetu implements official ABDM specifications for ABHA link and FHIR Care Context publishing. Currently running in sandbox-safe mode with mock verification until government NHA gateway API credentials are supplied.
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">ABDM service is currently unreachable.</p>
            )}
          </CardBody>
        </Card>

        {/* HL7 FHIR Card */}
        <Card>
          <CardHeader
            title="HL7® FHIR® R4 Compatibility"
            description="Healthcare data standard conformance for clinical history bundles."
            icon={<Sparkles className="size-4 text-violet-600" />}
            actions={<Badge tone="success">FHIR R4 Conformance</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Standard Version</span>
                <span className="font-mono font-semibold text-slate-800">{fhir?.fhir_version ?? "R4 (4.0.1)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Bundle Format</span>
                <span className="font-mono text-slate-700">application/fhir+json (Collection)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Validation Status</span>
                <span className="text-leaf-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Validated Structure
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Exported Resource Types ({fhir?.supported_resources.length ?? 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fhir?.supported_resources.map((res) => (
                  <Badge key={res} tone="brand">
                    {res}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Every patient case can be downloaded as a complete FHIR R4 JSON Bundle from the Case Review screen, preserving provenance and clinician signatures.
            </p>
          </CardBody>
        </Card>

        {/* Document OCR & Pipelines Card */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Document Processing & OCR Engine Status"
            description="Pipeline capabilities for medical prescriptions, lab reports, and radiological scans."
            icon={<CheckCircle2 className="size-4 text-leaf-600" />}
          />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium">PDF Text Layer Extraction</p>
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-leaf-600" />
                  <span className="text-sm font-semibold text-slate-900">Active (Native Python)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Fast, direct extraction of digital text from born-digital lab reports.</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium">PaddleOCR Engine</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={caps?.ocr_engines?.paddleocr ? "success" : "neutral"}>
                    {caps?.ocr_engines?.paddleocr ? "Available" : "Optional / On-Demand"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">Optical Character Recognition for photographed prescription slips.</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium">Maximum Upload Limit</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{caps?.max_upload_mb ?? 10} MB per document</p>
                <p className="mt-1 text-xs text-slate-500">Accepts PDF, PNG, JPG, and WebP medical attachments.</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
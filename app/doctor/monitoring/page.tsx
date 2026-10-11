"use client";

import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import Spinner, { Skeleton } from "@/components/ui/Spinner";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/status";
import type {
  HealthOverviewCard,
  MeasurementPoint,
  PatientHealthDashboard,
  QueueResponse,
} from "@/lib/types";

export default function DoctorMonitoringPage() {
  return (
    <DoctorShell>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <MonitoringContent />
      </Suspense>
    </DoctorShell>
  );
}

function MonitoringContent() {
  const { token, role } = useStaff();
  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get("patient_id");

  // Patients list for switcher
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    initialPatientId ? parseInt(initialPatientId, 10) : null
  );

  // Health Monitoring state
  const [dashboard, setDashboard] = useState<PatientHealthDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Timeline / Trend state
  const [selectedTestCode, setSelectedTestCode] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(6);
  const [timelinePoints, setTimelinePoints] = useState<MeasurementPoint[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Verification state
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  // Manual measurement entry state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTestCode, setAddTestCode] = useState("hba1c");
  const [addTestName, setAddTestName] = useState("HbA1c");
  const [addValue, setAddValue] = useState("");
  const [addUnit, setAddUnit] = useState("%");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [addingError, setAddingError] = useState<string | null>(null);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Load patient list
  const loadQueue = useCallback(async () => {
    try {
      const q = await api<QueueResponse>("/doctor/queue?scope=all&page_size=50", { token });
      setQueue(q);
      if (!selectedPatientId && q.items.length > 0) {
        setSelectedPatientId(q.items[0].patient_id);
      }
    } catch {
      // ignore queue load error
    }
  }, [token, selectedPatientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load queue once on mount
    loadQueue();
  }, [loadQueue]);

  // Load dashboard for selected patient
  const loadDashboard = useCallback(
    async (pId: number) => {
      setLoadingDashboard(true);
      setDashboardError(null);
      setVerifyNotice(null);
      try {
        const d = await api<PatientHealthDashboard>(`/health-monitoring/patient/${pId}/dashboard`, {
          token,
        });
        setDashboard(d);
        if (d.overview_cards.length > 0 && !selectedTestCode) {
          setSelectedTestCode(d.overview_cards[0].test_code);
        }
      } catch (err) {
        setDashboardError(errorMessage(err));
        setDashboard(null);
      } finally {
        setLoadingDashboard(false);
      }
    },
    [token, selectedTestCode]
  );

  useEffect(() => {
    if (selectedPatientId) {
      loadDashboard(selectedPatientId);
    }
  }, [selectedPatientId, loadDashboard]);

  // Load timeline when test code or timeframe changes
  const loadTimeline = useCallback(
    async (pId: number, testCode: string | null, months: number | null) => {
      if (!testCode) return;
      setLoadingTimeline(true);
      try {
        const queryParams = new URLSearchParams();
        if (testCode) queryParams.set("test_code", testCode);
        if (months) queryParams.set("months", months.toString());
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";

        const res = await api<{ items: MeasurementPoint[] }>(
          `/health-monitoring/patient/${pId}/timeline${qs}`,
          { token }
        );
        setTimelinePoints(res.items || []);
      } catch {
        setTimelinePoints([]);
      } finally {
        setLoadingTimeline(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (selectedPatientId && selectedTestCode) {
      loadTimeline(selectedPatientId, selectedTestCode, selectedMonths);
    }
  }, [selectedPatientId, selectedTestCode, selectedMonths, loadTimeline]);

  // Handle clinician verification toggle
  async function toggleVerification(point: MeasurementPoint) {
    const nextVerified = point.verification_status !== "clinician_verified";
    setVerifyingId(point.id);
    setVerifyNotice(null);
    try {
      await api(`/health-monitoring/measurements/${point.id}/verify`, {
        method: "PATCH",
        token,
        json: { verified: nextVerified },
      });
      setVerifyNotice(
        `Measurement #${point.id} (${point.test_name}) updated to ${
          nextVerified ? "Clinician Verified" : "Unverified"
        }.`
      );
      if (selectedPatientId) {
        loadDashboard(selectedPatientId);
        loadTimeline(selectedPatientId, selectedTestCode, selectedMonths);
      }
    } catch (err) {
      setVerifyNotice(`Verification failed: ${errorMessage(err)}`);
    } finally {
      setVerifyingId(null);
    }
  }

  // Handle adding manual measurement
  async function handleAddMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) return;
    const valNum = parseFloat(addValue);
    if (isNaN(valNum)) {
      setAddingError("Please enter a valid numeric test result.");
      return;
    }

    setIsSubmittingNew(true);
    setAddingError(null);
    try {
      await api(`/health-monitoring/patient/${selectedPatientId}/measurements`, {
        method: "POST",
        token,
        json: {
          test_code: addTestCode,
          test_name: addTestName,
          value: valNum,
          unit: addUnit,
          test_date: addDate,
          verification_status: "clinician_verified",
        },
      });
      setShowAddModal(false);
      setAddValue("");
      loadDashboard(selectedPatientId);
      loadTimeline(selectedPatientId, addTestCode, selectedMonths);
      setSelectedTestCode(addTestCode);
    } catch (err) {
      setAddingError(errorMessage(err));
    } finally {
      setIsSubmittingNew(false);
    }
  }

  const filteredPatients = useMemo(() => {
    if (!queue?.items) return [];
    if (!patientSearch.trim()) return queue.items;
    const term = patientSearch.toLowerCase();
    return queue.items.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        p.patient_id.toString().includes(term) ||
        (p.chief_complaint && p.chief_complaint.toLowerCase().includes(term))
    );
  }, [queue, patientSearch]);

  const activeCard = dashboard?.overview_cards.find((c) => c.test_code === selectedTestCode);

  return (
    <>
      <PageHeader
        title="Longitudinal Patient Health Monitoring"
        description="Deterministic biomarker progress tracking, guideline-directed target comparisons, and clinician verification."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedPatientId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadDashboard(selectedPatientId);
                  loadTimeline(selectedPatientId, selectedTestCode, selectedMonths);
                }}
              >
                <RefreshCw className="size-4" /> Refresh
              </Button>
            )}
            <Button size="sm" onClick={() => setShowAddModal(true)} disabled={!selectedPatientId}>
              <Plus className="size-4" /> Record Test Result
            </Button>
          </div>
        }
      />

      {/* Patient Selector Bar */}
      <Card className="mb-6 border-slate-200">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder="Search patient name / ID..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <select
              aria-label="Select Patient"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
              value={selectedPatientId ?? ""}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setSelectedPatientId(val);
              }}
            >
              <option value="" disabled>
                Select Monitored Patient
              </option>
              {filteredPatients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.full_name} (Patient #{p.patient_id})
                </option>
              ))}
            </select>
          </div>

          {dashboard && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                📁 <strong>{dashboard.total_reports_uploaded}</strong> reports
              </span>
              <span>
                ⏳ <strong>{dashboard.pending_verifications_count}</strong> pending verification
              </span>
              <span>🕒 Updated: {dashboard.last_updated.slice(0, 10)}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Clinical Safety Protocol Notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-900">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" />
        <div>
          <p className="font-semibold text-teal-950">
            Clinical Decision-Support & Monitoring Protocol (ADA 2024 / ICMR / KDIGO / WHO)
          </p>
          <p className="mt-0.5 text-teal-800 leading-relaxed">
            Trends are calculated deterministically across chronological records. This tool provides evidence tracking
            and target reconciliation. <strong>Final clinical judgment remains strictly with the attending physician.</strong>
          </p>
        </div>
      </div>

      {loadingDashboard ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : dashboardError ? (
        <Alert
          tone="danger"
          title="Could not load health dashboard"
          action={
            <Button size="sm" variant="outline" onClick={() => selectedPatientId && loadDashboard(selectedPatientId)}>
              Retry
            </Button>
          }
        >
          {dashboardError}
        </Alert>
      ) : !dashboard ? (
        <Card>
          <EmptyState
            icon={<User className="size-6" />}
            title="No patient selected"
            description="Select a patient from the dropdown above to inspect longitudinal health monitoring data."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Patient Overview Header Card */}
          <Card className="border-brand-200 bg-gradient-to-r from-brand-50/30 to-slate-50">
            <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{dashboard.patient_name}</h2>
                  <Badge tone="brand">Patient #{dashboard.patient_id}</Badge>
                  {dashboard.mobile && (
                    <span className="text-xs text-slate-500 font-mono">+91 {dashboard.mobile}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Tracked Conditions:</span>
                  {dashboard.active_conditions.length > 0 ? (
                    dashboard.active_conditions.map((cond) => (
                      <Badge key={cond} tone="neutral">
                        {cond}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs italic text-slate-400">Routine Preventive OPD Monitoring</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/doctor/patient/${dashboard.patient_id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  View All Visits →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Biomarker Overview Cards Grid */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Tracked Biomarkers ({dashboard.overview_cards.length})
              </h3>
              <span className="text-xs text-slate-500">Click a card to inspect trend line</span>
            </div>

            {dashboard.overview_cards.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Activity className="size-6" />}
                  title="No structured laboratory tests recorded"
                  description="Upload lab reports or enter measurements using the 'Record Test Result' button above."
                />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.overview_cards.map((card) => {
                  const isSelected = card.test_code === selectedTestCode;
                  const isVerified = card.verification_status === "clinician_verified";

                  const trendIcon =
                    card.trend_direction === "increasing" ? (
                      <TrendingUp className="size-4 text-rose-600" />
                    ) : card.trend_direction === "decreasing" ? (
                      <TrendingDown className="size-4 text-blue-600" />
                    ) : (
                      <span className="text-xs font-bold text-slate-500">➡️</span>
                    );

                  const refBadgeTone =
                    card.reference_status === "within_range"
                      ? "brand"
                      : card.reference_status === "above_range"
                      ? "danger"
                      : card.reference_status === "below_range"
                      ? "neutral"
                      : "neutral";

                  const refText =
                    card.reference_status === "within_range"
                      ? "In Target"
                      : card.reference_status === "above_range"
                      ? "Above Target"
                      : card.reference_status === "below_range"
                      ? "Below Target"
                      : "Target Unspecified";

                  return (
                    <div
                      key={card.test_code}
                      onClick={() => setSelectedTestCode(card.test_code)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-brand-600 bg-brand-50/20 shadow-md ring-2 ring-brand-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm leading-tight">
                            {card.canonical_name}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {card.category}
                          </span>
                        </div>
                        <Badge tone={isVerified ? "brand" : "warning"}>
                          {isVerified ? "Verified ✓" : "Extracted"}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between">
                        <div>
                          <span className="text-2xl font-bold text-slate-900 tnum">{card.current_value}</span>
                          <span className="ml-1 text-xs text-slate-500 font-medium">{card.unit}</span>
                          <span className="ml-2 text-[11px] text-slate-400">({card.current_test_date})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {trendIcon}
                          <span className="text-xs font-semibold capitalize text-slate-700">
                            {card.trend_direction}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                        <span className="text-slate-500">
                          {card.previous_value !== null ? (
                            <>
                              Prev: <strong>{card.previous_value}</strong>{" "}
                              <span className="font-mono text-[11px]">
                                ({card.is_percentage_metric
                                  ? `${card.absolute_change! > 0 ? "+" : ""}${card.absolute_change} % pts`
                                  : `${card.percentage_change! > 0 ? "+" : ""}${card.percentage_change}%`})
                              </span>
                            </>
                          ) : (
                            "Baseline Record"
                          )}
                        </span>
                        <Badge tone={refBadgeTone}>{refText}</Badge>
                      </div>

                      {card.patient_friendly_summary && (
                        <p className="mt-2 text-[11px] text-slate-600 leading-snug line-clamp-2">
                          {card.patient_friendly_summary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Longitudinal Trend Chart & Timeline Table */}
          {activeCard && (
            <Card className="border-slate-200">
              <CardHeader
                title={`Longitudinal Trend: ${activeCard.canonical_name}`}
                description={
                  activeCard.reference_low !== null && activeCard.reference_high !== null
                    ? `Clinical Target Range: ${activeCard.reference_low} – ${activeCard.reference_high} ${activeCard.unit} (${activeCard.guideline_source})`
                    : `Guideline: ${activeCard.guideline_source}`
                }
                icon={<Activity className="size-4 text-brand-700" />}
                actions={
                  <div className="flex items-center gap-1">
                    {[
                      { m: 1, label: "1M" },
                      { m: 3, label: "3M" },
                      { m: 6, label: "6M" },
                      { m: 12, label: "1Y" },
                      { m: null, label: "All" },
                    ].map(({ m, label }) => (
                      <button
                        key={label}
                        onClick={() => setSelectedMonths(m)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          selectedMonths === m
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              />
              <CardBody>
                {loadingTimeline ? (
                  <div className="flex h-56 items-center justify-center">
                    <Spinner label="Plotting chronological measurements..." />
                  </div>
                ) : timelinePoints.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    No data points found for this biomarker within the selected timeframe.
                  </div>
                ) : (
                  <>
                    {/* SVG Trend Chart */}
                    <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                      <TrendSvgChart
                        points={timelinePoints}
                        refLow={activeCard.reference_low}
                        refHigh={activeCard.reference_high}
                        unit={activeCard.unit}
                      />
                    </div>

                    {/* Verification Notice */}
                    {verifyNotice && (
                      <Alert tone="info" className="mb-4">
                        {verifyNotice}
                      </Alert>
                    )}

                    {/* Traceable Records Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Test Date</th>
                            <th className="py-2.5 px-3 font-semibold">Result</th>
                            <th className="py-2.5 px-3 font-semibold">Target / Reference</th>
                            <th className="py-2.5 px-3 font-semibold">Source Evidence & Traceability</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Clinician Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {timelinePoints.map((pt) => {
                            const isPtVerified = pt.verification_status === "clinician_verified";
                            return (
                              <tr key={pt.id} className="hover:bg-slate-50/70">
                                <td className="py-3 px-3 font-medium text-slate-900 tnum">
                                  {formatDate(pt.test_date)}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="font-bold text-slate-900">{pt.value}</span>{" "}
                                  <span className="text-xs text-slate-500">{pt.unit}</span>
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-600">
                                  {pt.ref_low !== null && pt.ref_high !== null
                                    ? `${pt.ref_low} – ${pt.ref_high} ${pt.unit}`
                                    : "Not specified"}
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-500">
                                  {pt.source_line ? (
                                    <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                      &quot;{pt.source_line}&quot;
                                    </span>
                                  ) : (
                                    <span className="italic">Manual Entry</span>
                                  )}
                                  {pt.document_id && (
                                    <span className="ml-1 text-[10px] text-brand-700">
                                      (Doc #{pt.document_id})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <Button
                                    size="sm"
                                    variant={isPtVerified ? "outline" : "primary"}
                                    loading={verifyingId === pt.id}
                                    onClick={() => toggleVerification(pt)}
                                  >
                                    {isPtVerified ? (
                                      <>
                                        <CheckCircle2 className="size-3.5 text-teal-600" /> Verified
                                      </>
                                    ) : (
                                      "Verify Result"
                                    )}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Manual Add Measurement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Record New Lab Test Result</h3>
            <p className="mt-1 text-xs text-slate-500">
              Enter a validated result for Patient #{selectedPatientId}. The deterministic trend engine will update
              longitudinal curves immediately.
            </p>

            {addingError && (
              <Alert tone="danger" className="mt-3">
                {addingError}
              </Alert>
            )}

            <form onSubmit={handleAddMeasurement} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Biomarker / Test</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  value={addTestCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setAddTestCode(code);
                    if (code === "hba1c") {
                      setAddTestName("HbA1c");
                      setAddUnit("%");
                    } else if (code === "fasting_glucose") {
                      setAddTestName("Fasting Blood Sugar");
                      setAddUnit("mg/dL");
                    } else if (code === "ppbs") {
                      setAddTestName("Post-Meal Blood Sugar");
                      setAddUnit("mg/dL");
                    } else if (code === "serum_creatinine") {
                      setAddTestName("Serum Creatinine");
                      setAddUnit("mg/dL");
                    } else if (code === "hemoglobin") {
                      setAddTestName("Hemoglobin");
                      setAddUnit("g/dL");
                    } else if (code === "tsh") {
                      setAddTestName("TSH");
                      setAddUnit("mIU/L");
                    } else if (code === "systolic_bp") {
                      setAddTestName("Systolic Blood Pressure");
                      setAddUnit("mmHg");
                    }
                  }}
                >
                  <option value="hba1c">HbA1c (%)</option>
                  <option value="fasting_glucose">Fasting Blood Sugar (mg/dL)</option>
                  <option value="ppbs">Post-Meal Blood Sugar (mg/dL)</option>
                  <option value="systolic_bp">Systolic BP (mmHg)</option>
                  <option value="serum_creatinine">Serum Creatinine (mg/dL)</option>
                  <option value="hemoglobin">Hemoglobin (g/dL)</option>
                  <option value="tsh">TSH (mIU/L)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Measured Value</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder="e.g. 7.2"
                    value={addValue}
                    onChange={(e) => setAddValue(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Unit</label>
                  <Input
                    required
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Test Date</label>
                <Input
                  required
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmittingNew}>
                  Save & Reconcile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TrendSvgChart({
  points,
  refLow,
  refHigh,
  unit,
}: {
  points: MeasurementPoint[];
  refLow: number | null;
  refHigh: number | null;
  unit: string;
}) {
  const sorted = useMemo(() => [...points].sort((a, b) => a.test_date.localeCompare(b.test_date)), [points]);
  if (sorted.length === 0) return null;

  const vals = sorted.map((p) => p.value);
  let minVal = Math.min(...vals);
  let maxVal = Math.max(...vals);

  if (refLow !== null) minVal = Math.min(minVal, refLow);
  if (refHigh !== null) maxVal = Math.max(maxVal, refHigh);

  const range = maxVal - minVal > 0.001 ? maxVal - minVal : 1;
  const effMin = minVal - range * 0.12;
  const effMax = maxVal + range * 0.12;
  const effRange = effMax - effMin;

  const svgWidth = 720;
  const svgHeight = 220;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const width = svgWidth - padLeft - padRight;
  const height = svgHeight - padTop - padBottom;

  const getY = (val: number) => {
    const ratio = (val - effMin) / effRange;
    return padTop + height - ratio * height;
  };

  const getX = (idx: number) => {
    if (sorted.length === 1) return padLeft + width / 2;
    return padLeft + (idx / (sorted.length - 1)) * width;
  };

  const pathD = sorted.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getY(pt.value);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto min-w-[500px]"
        aria-label="Longitudinal Trend Chart"
      >
        {/* Reference High Guideline Line */}
        {refHigh !== null && (
          <g>
            <line
              x1={padLeft}
              y1={getY(refHigh)}
              x2={svgWidth - padRight}
              y2={getY(refHigh)}
              stroke="#fb923c"
              strokeWidth="1.5"
              strokeDasharray="5,5"
            />
            <text
              x={padLeft - 6}
              y={getY(refHigh) + 4}
              fontSize="10"
              fill="#c2410c"
              textAnchor="end"
              fontWeight="600"
            >
              High ({refHigh})
            </text>
          </g>
        )}

        {/* Reference Low Guideline Line */}
        {refLow !== null && (
          <g>
            <line
              x1={padLeft}
              y1={getY(refLow)}
              x2={svgWidth - padRight}
              y2={getY(refLow)}
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeDasharray="5,5"
            />
            <text
              x={padLeft - 6}
              y={getY(refLow) + 4}
              fontSize="10"
              fill="#1d4ed8"
              textAnchor="end"
              fontWeight="600"
            >
              Low ({refLow})
            </text>
          </g>
        )}

        {/* Trend Polyline */}
        {sorted.length > 1 && (
          <path d={pathD} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data Point Circles and Labels */}
        {sorted.map((pt, i) => {
          const cx = getX(i);
          const cy = getY(pt.value);
          const isVerified = pt.verification_status === "clinician_verified";

          return (
            <g key={pt.id}>
              <circle
                cx={cx}
                cy={cy}
                r="6"
                fill={isVerified ? "#0f766e" : "#f59e0b"}
                stroke="#ffffff"
                strokeWidth="2"
              />
              {/* Value Text Above Node */}
              <text
                x={cx}
                y={cy - 10}
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
                textAnchor="middle"
              >
                {pt.value}
              </text>
              {/* Date Text Below Axis */}
              <text
                x={cx}
                y={svgHeight - 10}
                fontSize="11"
                fill="#64748b"
                textAnchor="middle"
              >
                {pt.test_date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

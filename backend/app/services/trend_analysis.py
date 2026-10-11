"""
Clinical Measurement Registry and Deterministic Trend Analysis Engine for Jivsetu MediKiosk.

Core Principle:
"Track the evidence. Explain the trend. Keep the clinician in control."

- Deterministic calculation: Absolute change and Percentage change (where clinically appropriate).
- Percentage-point change for percentage metrics (e.g. HbA1c).
- Standardized reference ranges and clinical guideline attribution.
- Clinician review verification and source document traceability.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MeasurementDef:
    test_code: str
    canonical_name: str
    category: str  # diabetes, blood_pressure, lipids, renal, thyroid, hematology, general
    primary_unit: str
    accepted_units: List[str]
    is_percentage_metric: bool = False  # e.g. HbA1c (use percentage points, not relative %)
    default_ref_low: Optional[float] = None
    default_ref_high: Optional[float] = None
    ref_source: str = ""
    guideline_name: str = ""
    guideline_version: str = ""
    aliases: List[str] = field(default_factory=list)


# Measurement Registry
MEASUREMENT_REGISTRY: Dict[str, MeasurementDef] = {
    "hba1c": MeasurementDef(
        test_code="hba1c",
        canonical_name="Glycated Hemoglobin (HbA1c)",
        category="diabetes",
        primary_unit="%",
        accepted_units=["%", "mmol/mol"],
        is_percentage_metric=True,
        default_ref_low=4.0,
        default_ref_high=5.6,
        ref_source="ADA Standards of Care in Diabetes (Normal < 5.7%, Prediabetes 5.7-6.4%, Diabetes >= 6.5%)",
        guideline_name="ADA Standards of Medical Care in Diabetes",
        guideline_version="2026",
        aliases=["hba1c", "glycated hemoglobin", "glycohemoglobin", "a1c", "hb a1c"]
    ),
    "fasting_glucose": MeasurementDef(
        test_code="fasting_glucose",
        canonical_name="Fasting Blood Glucose (FPG)",
        category="diabetes",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
        is_percentage_metric=False,
        default_ref_low=70.0,
        default_ref_high=99.0,
        ref_source="ADA / ICMR Guidelines (Normal 70-99 mg/dL, Impaired 100-125 mg/dL, Diabetes >= 126 mg/dL)",
        guideline_name="ICMR Guidelines for Type 2 Diabetes",
        guideline_version="2025-2026",
        aliases=["fasting blood sugar", "fasting glucose", "fbs", "fpg", "fasting plasma glucose"]
    ),
    "postprandial_glucose": MeasurementDef(
        test_code="postprandial_glucose",
        canonical_name="Post-Meal Blood Glucose (PPBS)",
        category="diabetes",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
        is_percentage_metric=False,
        default_ref_low=70.0,
        default_ref_high=139.0,
        ref_source="ADA / ICMR Guidelines (Normal < 140 mg/dL, Impaired 140-199 mg/dL, Diabetes >= 200 mg/dL)",
        guideline_name="ICMR Guidelines for Type 2 Diabetes",
        guideline_version="2025-2026",
        aliases=["ppbs", "pp glucose", "post prandial blood sugar", "post meal glucose", "postprandial glucose"]
    ),
    "blood_pressure_systolic": MeasurementDef(
        test_code="blood_pressure_systolic",
        canonical_name="Systolic Blood Pressure",
        category="blood_pressure",
        primary_unit="mmHg",
        accepted_units=["mmHg", "mm hg"],
        is_percentage_metric=False,
        default_ref_low=90.0,
        default_ref_high=120.0,
        ref_source="AHA / ACC / Indian Guidelines on Hypertension (Normal < 120 mmHg)",
        guideline_name="Indian Hypertension Guidelines (IAGH-IV)",
        guideline_version="2024-2026",
        aliases=["systolic", "sbp", "systolic bp"]
    ),
    "blood_pressure_diastolic": MeasurementDef(
        test_code="blood_pressure_diastolic",
        canonical_name="Diastolic Blood Pressure",
        category="blood_pressure",
        primary_unit="mmHg",
        accepted_units=["mmHg", "mm hg"],
        is_percentage_metric=False,
        default_ref_low=60.0,
        default_ref_high=80.0,
        ref_source="AHA / ACC / Indian Guidelines on Hypertension (Normal < 80 mmHg)",
        guideline_name="Indian Hypertension Guidelines (IAGH-IV)",
        guideline_version="2024-2026",
        aliases=["diastolic", "dbp", "diastolic bp"]
    ),
    "total_cholesterol": MeasurementDef(
        test_code="total_cholesterol",
        canonical_name="Total Cholesterol",
        category="lipids",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L"],
        is_percentage_metric=False,
        default_ref_low=125.0,
        default_ref_high=200.0,
        ref_source="NCEP ATP III / Lipid Association of India (Desirable < 200 mg/dL)",
        guideline_name="Lipid Association of India Expert Consensus",
        guideline_version="2024",
        aliases=["cholesterol total", "serum cholesterol", "total cholesterol", "tc"]
    ),
    "ldl_cholesterol": MeasurementDef(
        test_code="ldl_cholesterol",
        canonical_name="LDL Cholesterol",
        category="lipids",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L"],
        is_percentage_metric=False,
        default_ref_low=50.0,
        default_ref_high=100.0,
        ref_source="Lipid Association of India (Optimal < 100 mg/dL, High Risk < 70 mg/dL)",
        guideline_name="Lipid Association of India Expert Consensus",
        guideline_version="2024",
        aliases=["ldl", "ldl-c", "low density lipoprotein cholesterol"]
    ),
    "hdl_cholesterol": MeasurementDef(
        test_code="hdl_cholesterol",
        canonical_name="HDL Cholesterol",
        category="lipids",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L"],
        is_percentage_metric=False,
        default_ref_low=40.0,
        default_ref_high=60.0,
        ref_source="NCEP ATP III (Protective >= 40 mg/dL men, >= 50 mg/dL women)",
        guideline_name="Lipid Association of India Expert Consensus",
        guideline_version="2024",
        aliases=["hdl", "hdl-c", "high density lipoprotein cholesterol"]
    ),
    "triglycerides": MeasurementDef(
        test_code="triglycerides",
        canonical_name="Serum Triglycerides",
        category="lipids",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "mmol/L"],
        is_percentage_metric=False,
        default_ref_low=50.0,
        default_ref_high=150.0,
        ref_source="NCEP ATP III (Normal < 150 mg/dL)",
        guideline_name="Lipid Association of India Expert Consensus",
        guideline_version="2024",
        aliases=["triglyceride", "tg", "serum triglycerides", "triglycerides"]
    ),
    "serum_creatinine": MeasurementDef(
        test_code="serum_creatinine",
        canonical_name="Serum Creatinine",
        category="renal",
        primary_unit="mg/dL",
        accepted_units=["mg/dL", "mg/dl", "µmol/L", "umol/L"],
        is_percentage_metric=False,
        default_ref_low=0.7,
        default_ref_high=1.3,
        ref_source="KDIGO Clinical Practice Guideline (Adult ref approx 0.7 - 1.3 mg/dL)",
        guideline_name="KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease",
        guideline_version="2024",
        aliases=["creatinine", "serum creatinine", "s creatinine"]
    ),
    "hemoglobin": MeasurementDef(
        test_code="hemoglobin",
        canonical_name="Hemoglobin (Hb)",
        category="hematology",
        primary_unit="g/dL",
        accepted_units=["g/dL", "g/dl", "g/L"],
        is_percentage_metric=False,
        default_ref_low=12.0,
        default_ref_high=16.0,
        ref_source="WHO / ICMR Anemia Criteria (Women >= 12.0 g/dL, Men >= 13.0 g/dL)",
        guideline_name="WHO Guideline on Hemoglobin Concentrations for the Diagnosis of Anemia",
        guideline_version="2024",
        aliases=["hb", "hemoglobin", "haemoglobin", "hgb"]
    ),
    "tsh": MeasurementDef(
        test_code="tsh",
        canonical_name="Thyroid Stimulating Hormone (TSH)",
        category="thyroid",
        primary_unit="µIU/mL",
        accepted_units=["µIU/mL", "uIU/mL", "mIU/L", "uIU/ml"],
        is_percentage_metric=False,
        default_ref_low=0.4,
        default_ref_high=4.5,
        ref_source="Indian Thyroid Society / ATA Guidelines (Adult reference 0.4 - 4.5 µIU/mL)",
        guideline_name="Indian Thyroid Society Clinical Management Protocol",
        guideline_version="2024",
        aliases=["tsh", "thyroid stimulating hormone", "s tsh", "serum tsh"]
    )
}


def resolve_canonical_test_code(test_name: str) -> Optional[str]:
    """Resolves arbitrary test names from OCR to canonical test codes in the registry."""
    clean = " ".join(str(test_name).strip().lower().replace("_", " ").replace("-", " ").split())
    for code, mdef in MEASUREMENT_REGISTRY.items():
        if clean == code or clean == mdef.canonical_name.lower():
            return code
        for alias in mdef.aliases:
            if clean == alias or alias in clean:
                return code
    return None


@dataclass
class TrendResult:
    test_code: str
    canonical_name: str
    category: str
    unit: str
    current_value: float
    current_test_date: str
    previous_value: Optional[float]
    previous_test_date: Optional[str]
    absolute_change: Optional[float]
    percentage_change: Optional[float]
    is_percentage_metric: bool
    trend_direction: str  # "increasing", "decreasing", "stable", "insufficient_data"
    patient_friendly_summary: str
    reference_low: Optional[float]
    reference_high: Optional[float]
    within_reference: Optional[bool]
    reference_status: str  # "within_range", "above_range", "below_range", "unspecified"
    guideline_source: str
    clinician_target_low: Optional[float] = None
    clinician_target_high: Optional[float] = None
    total_data_points: int = 1


def calculate_measurement_trend(
    test_code: str,
    measurements: List[Dict[str, Any]],
    clinician_target_low: Optional[float] = None,
    clinician_target_high: Optional[float] = None
) -> TrendResult:
    """
    Deterministic trend calculation given sorted historical records of the same test.
    Records must contain 'value' (float or numeric string) and 'test_date' (ISO string YYYY-MM-DD).
    """
    mdef = MEASUREMENT_REGISTRY.get(test_code, MeasurementDef(
        test_code=test_code,
        canonical_name=test_code.replace("_", " ").title(),
        category="general",
        primary_unit="",
        accepted_units=[]
    ))

    # Filter valid numeric values
    valid_points: List[Tuple[date, float, Dict[str, Any]]] = []
    for item in measurements:
        try:
            val = float(item["value"])
            d_raw = item.get("test_date") or item.get("created_at")
            if isinstance(d_raw, datetime):
                dt = d_raw.date()
            elif isinstance(d_raw, date):
                dt = d_raw
            elif isinstance(d_raw, str):
                dt = datetime.fromisoformat(d_raw.replace("Z", "").split("T")[0]).date()
            else:
                continue
            valid_points.append((dt, val, item))
        except (ValueError, TypeError):
            continue

    # Sort chronologically
    valid_points.sort(key=lambda x: x[0])

    if not valid_points:
        return TrendResult(
            test_code=test_code,
            canonical_name=mdef.canonical_name,
            category=mdef.category,
            unit=mdef.primary_unit,
            current_value=0.0,
            current_test_date=date.today().isoformat(),
            previous_value=None,
            previous_test_date=None,
            absolute_change=None,
            percentage_change=None,
            is_percentage_metric=mdef.is_percentage_metric,
            trend_direction="insufficient_data",
            patient_friendly_summary="No valid measurement data available to analyze.",
            reference_low=mdef.default_ref_low,
            reference_high=mdef.default_ref_high,
            within_reference=None,
            reference_status="unspecified",
            guideline_source=mdef.ref_source,
            total_data_points=0
        )

    latest_date, latest_val, _ = valid_points[-1]

    # Evaluate reference range
    ref_low = mdef.default_ref_low
    ref_high = mdef.default_ref_high
    within_ref: Optional[bool] = None
    ref_status = "unspecified"
    if ref_low is not None and ref_high is not None:
        if ref_low <= latest_val <= ref_high:
            within_ref = True
            ref_status = "within_range"
        elif latest_val > ref_high:
            within_ref = False
            ref_status = "above_range"
        else:
            within_ref = False
            ref_status = "below_range"

    if len(valid_points) == 1:
        summary = f"Current result is {latest_val} {mdef.primary_unit}. "
        if ref_status == "within_range":
            summary += "This value is within the standard reference range."
        elif ref_status == "above_range":
            summary += "This value is higher than the standard reference range."
        elif ref_status == "below_range":
            summary += "This value is lower than the standard reference range."
        summary += " Further reports will build your longitudinal trend."

        return TrendResult(
            test_code=test_code,
            canonical_name=mdef.canonical_name,
            category=mdef.category,
            unit=mdef.primary_unit,
            current_value=latest_val,
            current_test_date=latest_date.isoformat(),
            previous_value=None,
            previous_test_date=None,
            absolute_change=None,
            percentage_change=None,
            is_percentage_metric=mdef.is_percentage_metric,
            trend_direction="insufficient_data",
            patient_friendly_summary=summary,
            reference_low=ref_low,
            reference_high=ref_high,
            within_reference=within_ref,
            reference_status=ref_status,
            guideline_source=mdef.ref_source,
            clinician_target_low=clinician_target_low,
            clinician_target_high=clinician_target_high,
            total_data_points=1
        )

    prev_date, prev_val, _ = valid_points[-2]
    abs_change = round(latest_val - prev_val, 2)

    # Percentage change
    pct_change: Optional[float] = None
    if not mdef.is_percentage_metric:
        if prev_val != 0.0:
            pct_change = round(((latest_val - prev_val) / abs(prev_val)) * 100.0, 1)

    # Direction threshold (0.5% tolerance or 0.1 for small metrics)
    threshold = 0.1 if mdef.is_percentage_metric else 0.5
    if abs_change > threshold:
        direction = "increasing"
        direction_phrase = "Higher than your previous result"
    elif abs_change < -threshold:
        direction = "decreasing"
        direction_phrase = "Lower than your previous result"
    else:
        direction = "stable"
        direction_phrase = "Little change compared with your previous result"

    # Clinical explanation building
    if mdef.is_percentage_metric:
        change_desc = f"{abs(abs_change):.1f} percentage points {'higher' if abs_change > 0 else 'lower'}"
    else:
        change_desc = f"{abs(abs_change):.1f} {mdef.primary_unit} {'higher' if abs_change > 0 else 'lower'}"
        if pct_change is not None:
            change_desc += f" ({abs(pct_change):.1f}%)"

    summary_text = (
        f"{direction_phrase}. Your latest result is {latest_val} {mdef.primary_unit} "
        f"(previously {prev_val} {mdef.primary_unit} on {prev_date.strftime('%d %b %Y')}), "
        f"a change of {abs_change:+g}{' percentage points' if mdef.is_percentage_metric else ' ' + mdef.primary_unit}. "
    )

    if ref_status == "within_range":
        summary_text += "Current value is within the standard reference range."
    elif ref_status == "above_range":
        summary_text += "Current value is outside the configured reference range (above normal)."
    elif ref_status == "below_range":
        summary_text += "Current value is outside the configured reference range (below normal)."

    summary_text += " Your doctor will interpret this trend alongside your overall clinical progress."

    return TrendResult(
        test_code=test_code,
        canonical_name=mdef.canonical_name,
        category=mdef.category,
        unit=mdef.primary_unit,
        current_value=latest_val,
        current_test_date=latest_date.isoformat(),
        previous_value=prev_val,
        previous_test_date=prev_date.isoformat(),
        absolute_change=abs_change,
        percentage_change=pct_change,
        is_percentage_metric=mdef.is_percentage_metric,
        trend_direction=direction,
        patient_friendly_summary=summary_text,
        reference_low=ref_low,
        reference_high=ref_high,
        within_reference=within_ref,
        reference_status=ref_status,
        guideline_source=mdef.ref_source,
        clinician_target_low=clinician_target_low,
        clinician_target_high=clinician_target_high,
        total_data_points=len(valid_points)
    )
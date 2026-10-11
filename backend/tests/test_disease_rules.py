import pytest
from app.services.case_summary import build_case_summary, evaluate_disease_rules


def test_diabetes_evidence_reconciliation_diabetes_range():
    history_data = {"chief_complaint": "follow_up", "diabetes": "yes"}
    doc = {
        "id": 101,
        "filename": "diabetes_lab_report.pdf",
        "extraction": {
            "data": {
                "lab_values": [
                    {"test_name": "HbA1c", "value": "7.8", "unit": "%", "source_text": "HbA1c: 7.8 %"},
                    {"test_name": "Fasting Plasma Glucose", "value": "164", "unit": "mg/dL", "source_text": "Fasting Glucose: 164 mg/dL"}
                ],
                "medications": [
                    {"name": "Metformin", "strength": "500 mg", "frequency": "BD", "source_text": "Tab Metformin 500 mg BD"}
                ]
            }
        }
    }
    summary = build_case_summary(history_data, [], [doc])
    considerations = summary.get("clinical_considerations", [])
    assert len(considerations) >= 1
    dm = next(c for c in considerations if c["disease"] == "Diabetes Mellitus")
    assert dm["status"] == "diabetes_range"
    assert "HbA1c 7.8%" in dm["headline"]
    assert any("Confirmation test" in m for m in dm["missing_or_conflicts"])


def test_diabetes_evidence_reconciliation_prediabetes_range():
    """Verify that HbA1c ~6.0% is interpreted as Prediabetes Range (5.7%-6.4%) and NOT labeled as confirmed Diabetes."""
    history_data = {"chief_complaint": "follow_up", "diabetes": "no"}
    doc = {
        "id": 102,
        "filename": "routine_health_checkup.pdf",
        "extraction": {
            "data": {
                "lab_values": [
                    {"test_name": "HbA1c", "value": "6.0", "unit": "%", "source_text": "HbA1c: 6.0 %"}
                ],
                "medications": []
            }
        }
    }
    summary = build_case_summary(history_data, [], [doc])
    considerations = summary.get("clinical_considerations", [])
    dm = next(c for c in considerations if c["disease"] == "Diabetes Mellitus")
    assert dm["status"] == "prediabetes_range"
    assert "HbA1c 6.0%" in dm["headline"]
    assert "Prediabetes Range" in dm["headline"]
    assert "NOT confirmed Diabetes" in dm["missing_or_conflicts"][0]


def test_acute_coronary_syndrome_emergency_rules():
    history_data = {
        "chief_complaint": "chest_pain",
        "chest_pain_severity": "severe",
        "chest_pain_radiation": "left_arm",
        "sweating": "yes",
        "breathlessness": "yes"
    }
    red_flags = ["Severe chest pain reported.", "Sweating reported with chest pain."]
    doc = {
        "id": 103,
        "filename": "cardiac_enzymes.pdf",
        "extraction": {
            "data": {
                "lab_values": [
                    {"test_name": "Troponin I", "value": "2.4", "unit": "ng/mL", "source_text": "Troponin I: 2.4 ng/mL"}
                ]
            }
        }
    }
    summary = build_case_summary(history_data, red_flags, [doc])
    considerations = summary.get("clinical_considerations", [])
    acs = next(c for c in considerations if c["disease"] == "Acute Coronary Syndrome / Ischemic Heart Disease")
    assert acs["status"] == "urgent_screening"
    assert "ACC/AHA" in acs["guideline"]


def test_dengue_platelet_warning_rule():
    history_data = {"chief_complaint": "fever"}
    doc = {
        "id": 104,
        "filename": "cbc_report.pdf",
        "extraction": {
            "data": {
                "lab_values": [
                    {"test_name": "Platelet Count", "value": "85", "unit": "x10^3/µL", "source_text": "Platelets: 85 x10^3/µL"},
                    {"test_name": "Dengue NS1 Ag", "value": "Positive", "unit": "", "source_text": "Dengue NS1: Positive"}
                ]
            }
        }
    }
    summary = build_case_summary(history_data, [], [doc])
    considerations = summary.get("clinical_considerations", [])
    dengue = next(c for c in considerations if c["disease"] == "Dengue Fever")
    assert dengue["status"] == "warning_threshold"
    assert "NVBDCP / WHO" in dengue["guideline"]


def test_oncology_tumor_marker_framework():
    history_data = {"chief_complaint": "other"}
    doc = {
        "id": 105,
        "filename": "tumor_markers.pdf",
        "extraction": {
            "data": {
                "lab_values": [
                    {"test_name": "CEA", "value": "14.2", "unit": "ng/mL", "source_text": "CEA: 14.2 ng/mL"}
                ]
            }
        }
    }
    summary = build_case_summary(history_data, [], [doc])
    considerations = summary.get("clinical_considerations", [])
    onc = next(c for c in considerations if c["disease"] == "Oncology Investigation / Tumor Marker Review")
    assert onc["status"] == "tumor_marker_review"
    assert "Not a standalone cancer diagnosis" in onc["guideline"]

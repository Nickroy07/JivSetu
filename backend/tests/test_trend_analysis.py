from app.services.trend_analysis import (
    MEASUREMENT_REGISTRY,
    calculate_measurement_trend,
    resolve_canonical_test_code,
)


def test_resolve_canonical_test_code():
    assert resolve_canonical_test_code("HbA1c") == "hba1c"
    assert resolve_canonical_test_code("FastING Blood Sugar") == "fasting_glucose"
    assert resolve_canonical_test_code("Serum Creatinine") == "serum_creatinine"
    assert resolve_canonical_test_code("Total Cholesterol") == "total_cholesterol"
    assert resolve_canonical_test_code("Unknown Random Test") is None


def test_hba1c_percentage_point_trend():
    records = [
        {"value": 8.2, "test_date": "2026-04-10"},
        {"value": 7.8, "test_date": "2026-07-15"},
    ]
    res = calculate_measurement_trend("hba1c", records)
    assert res.current_value == 7.8
    assert res.previous_value == 8.2
    assert res.absolute_change == -0.4
    assert res.percentage_change is None  # Must NOT compute relative % for HbA1c
    assert res.is_percentage_metric is True
    assert res.trend_direction == "decreasing"
    assert "Lower than your previous result" in res.patient_friendly_summary
    assert "percentage points" in res.patient_friendly_summary


def test_fasting_glucose_trend_and_percent():
    records = [
        {"value": 110.0, "test_date": "2026-01-05"},
        {"value": 125.0, "test_date": "2026-05-10"},
    ]
    res = calculate_measurement_trend("fasting_glucose", records)
    assert res.current_value == 125.0
    assert res.previous_value == 110.0
    assert res.absolute_change == 15.0
    assert res.percentage_change == 13.6
    assert res.trend_direction == "increasing"
    assert res.reference_status == "above_range"


def test_single_measurement():
    records = [{"value": 1.0, "test_date": "2026-09-01"}]
    res = calculate_measurement_trend("serum_creatinine", records)
    assert res.current_value == 1.0
    assert res.previous_value is None
    assert res.trend_direction == "insufficient_data"
    assert res.reference_status == "within_range"
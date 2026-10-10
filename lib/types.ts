export interface CaseRow {
  visit_id: number;
  patient_id: number;
  full_name: string;
  mobile_last4: string;
  status: string;
  chief_complaint: string | null;
  visit_date: string | null;
  updated_at: string | null;
  physician_status: string | null;
  red_flags: number;
  documents: number;
  documents_failed: number;
  documents_processing: number;
}

export interface Overview {
  counts: {
    in_queue: number;
    today: number;
    awaiting_review: number;
    completed: number;
    failed_documents: number;
    by_status: Record<string, number>;
  };
  recent_cases: CaseRow[];
  processing_failures: {
    document_id: number;
    patient_id: number;
    full_name: string;
    visit_id: number | null;
    document_type: string;
    error: string | null;
    updated_at: string | null;
  }[];
  activity: { id: number; action: string; label: string; resource_type: string; resource_id: string; details: string | null; created_at: string | null }[];
}

export interface QueueResponse {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: CaseRow[];
}

export interface SourceRef {
  type: "patient" | "document";
  question_id?: string;
  document_id?: number;
  filename?: string;
  source_text?: string | null;
  value?: string;
}

export interface Medication { name: string; strength?: string | null; frequency?: string | null; source_text?: string | null }
export interface LabValue { test_name: string; value: string; unit?: string | null; source_text?: string | null }

export interface ExtractionData {
  document_type?: string;
  document_date?: string | null;
  patient_name?: string | null;
  doctor_name?: string | null;
  hospital_name?: string | null;
  diagnoses_mentioned?: string[];
  allergies_mentioned?: string[];
  medications?: Medication[];
  lab_values?: LabValue[];
}

export interface DocumentItem {
  id: number;
  patient_id: number | null;
  visit_id: number | null;
  document_type: string;
  filename: string;
  mime_type: string;
  file_size: number;
  upload_status: string;
  ocr_status: string;
  extraction_method: string | null;
  processing: boolean;
  processing_error: string | null;
  can_retry: boolean;
  created_at: string | null;
  updated_at: string | null;
  ocr_text?: string;
  extraction: null | {
    status: string;
    data: ExtractionData;
    reviewed_data: ExtractionData | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    fields_found: number;
    coverage: number;
  };
}

export interface DraftSummary {
  kind: string;
  disclaimer: string;
  narrative: string;
  sections: { title: string; items: { field: string; label: string; value: string; source: SourceRef }[] }[];
  document_facts: {
    medications: (Medication & { reviewed: boolean; source: SourceRef })[];
    lab_values: (LabValue & { reviewed: boolean; source: SourceRef })[];
    diagnoses: { text: string; reviewed: boolean; source: SourceRef }[];
    allergies: { text: string; reviewed: boolean; source: SourceRef }[];
  };
  missing_information: { field: string; label: string; section: string; reason: string }[];
  conflicts: { field: string; message: string; patient: SourceRef; documents: SourceRef[] }[];
}

export interface RedFlagItem {
  code?: string;
  severity?: "urgent" | "attention";
  message?: string;
  question_id?: string;
  answer?: string;
}

export interface ClinicalHistoryRecord {
  id: number;
  visit_id: number;
  patient_id: number;
  chief_complaint: string | null;
  history_data: Record<string, string>;
  red_flags: (RedFlagItem | string)[];
  doctor_edits: Record<string, string>;
  physician_status: string;
  physician_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CompleteCase {
  patient: { id: number; full_name: string | null; mobile: string | null };
  visit: { id: number; visit_date: string | null; status: string; chief_complaint: string | null; updated_at: string | null };
  clinical_history: ClinicalHistoryRecord | null;
  draft_summary: DraftSummary | null;
  documents: DocumentItem[];
  stats: Record<string, number>;
}

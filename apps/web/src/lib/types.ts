export interface ResumeBullets {
    text: string;
    job_chunks?: number[];
    evidence?: string;
    keywords?: string[];
    rationale?: string;
    transferable?: boolean;
}

export interface TalkingPoint {
    text: string;
    type?: "strength" | "emphasis" | "reminder";
    job_chunks?: number[];
}

export interface TalkingPlaybookJSON {
    strengths: { requirement: string; evidence?: string; rationale?: string }[];
    gaps: { requirement: string; rationale: string; mitigation: string }[];
    interview_questions: {
        question: string;
        expected_focus?: string;
        answer_tips?: string[];
        prep_example?: string;
    }[];
    summary?: {
        overall_strengths?: string[];
        overall_gaps?: string[];
        prep_focus?: string[];
    };
}

export interface CoverLetterJSON {
    subject: string;
    greeting: string;
    body_paragraphs: string[];
    valediction: string;
    signature: string;
}

export interface AlignmentJSON {
    summary: string;
    coverage: number;
    strengths: { requirement: string; evidence_resume?: string; job_chunks?: number[] }[];
    gaps: { requirement: string; why_it_matters?: string; suggested_edit?: string }[];
    missing_keywords?: string[];
    suggested_edits?: { type: string; before?: string; after: string; note?: string }[];
    questions_for_candidate?: string[];
}

export interface Draft {
    client_ref_id: string;  // Primary key - this is the actual ID in the database
    id?: string;  // Legacy/optional field if backend ever returns it
    created_at: string;
    user_id: string;
    job_title?: string;
    company_name?: string;
    job_link?: string;

    // Structured outputs
    resume_bullets?: { bullets: ResumeBullets[] } | ResumeBullets[];
    interview_points?: { points: TalkingPoint[] } | TalkingPoint[] | TalkingPlaybookJSON;
    cover_letter?: string | CoverLetterJSON;
    ats_alignment?: AlignmentJSON;
    first_impression?: unknown;
    bender_score?: number;
    bender_score_data?: unknown;

    // Raw inputs/outputs
    resume_text?: string;
    job_description_text?: string;
    outputs_json?: Record<string, unknown>;
}

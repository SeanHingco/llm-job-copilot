"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getHistoryDetail, deleteHistoryDraft } from "../../../lib/api";
import { Draft, TalkingPlaybookJSON, CoverLetterJSON, ResumeBullets, AlignmentJSON } from "../../../lib/types";
import ConfirmDialog from "components/ConfirmDialog";
import BulletsView from "components/BulletsView";
import TalkingPlaybookView from "components/TalkingPlaybookView";
import AlignmentView from "components/AlignmentView";
import CoverLetterView from "components/CoverLetterView";

// Helper function to get color classes based on score (for badges with background)
function getScoreColorClasses(score: number): string {
    if (score < 50) {
        // Red for 0-50
        return "bg-red-100 text-red-700";
    } else if (score < 80) {
        // Yellow for 50-80
        return "bg-yellow-100 text-yellow-700";
    } else {
        // Green for 80-100
        return "bg-emerald-100 text-emerald-700";
    }
}

// Helper function to get text color only based on score (for large numbers)
function getScoreTextColor(score: number): string {
    if (score < 50) {
        // Red for 0-50
        return "text-red-700";
    } else if (score < 80) {
        // Yellow for 50-80
        return "text-yellow-700";
    } else {
        // Green for 80-100
        return "text-emerald-700";
    }
}

// Utility function to extract JSON from markdown code blocks
function extractJsonFromMarkdownString(s: string): unknown | null {
    // strip ```lang … ``` and grab the first {...} block
    const fenceMatch = s.match(/```[\s\S]*?```/);
    const inner = fenceMatch ? fenceMatch[0] : s;

    // remove the ```lang\n prefix and closing ```
    const withoutFences = inner
        .replace(/^```[a-zA-Z]*\s*\n?/, "")
        .replace(/```$/, "")
        .trim();

    // get tightest outer braces
    const first = withoutFences.indexOf("{");
    const last = withoutFences.lastIndexOf("}");
    const candidate = first >= 0 && last > first
        ? withoutFences.slice(first, last + 1)
        : withoutFences;

    try { return JSON.parse(candidate); } catch { return null; }
}

// Utility to parse a field that might be a string, object, or array
function parseField<T>(field: unknown): T | null {
    if (!field) return null;
    
    // If it's already an object/array, return as-is
    if (typeof field === 'object' && field !== null) {
        return field as T;
    }
    
    // If it's a string, try to parse it
    if (typeof field === 'string') {
        // First try direct JSON parse
        try {
            const parsed = JSON.parse(field);
            return parsed as T;
        } catch {
            // If that fails, try extracting from markdown code blocks
            const extracted = extractJsonFromMarkdownString(field);
            if (extracted) return extracted as T;
        }
    }
    
    return null;
}

export default function DraftHistoryDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    useEffect(() => {
        if (!id || id === '#') {
            setLoading(false);
            return;
        }
        async function load() {
            try {
                console.log('[DraftHistoryDetail] Loading draft with id:', id);
                const d = await getHistoryDetail(id);
                console.log('[DraftHistoryDetail] Received draft data:', d);
                if (d) {
                    setDraft(d);
                } else {
                    console.warn('[DraftHistoryDetail] No draft data returned');
                }
            } catch (e) {
                console.error("[DraftHistoryDetail] Failed to load draft:", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    // Parse the draft data to handle string fields that might contain JSON
    // Also check outputs_json as a fallback source for data
    const parsedDraft = useMemo(() => {
        if (!draft) return null;

        const parsed = { ...draft };
        const outputs = draft.outputs_json || {};

        // Helper to parse a field, checking both direct field and outputs_json
        const parseFieldFromDraft = <T,>(
            directField: unknown,
            outputsKey: string,
            parseFn: (val: unknown) => T | null
        ): T | null => {
            // First try direct field
            if (directField) {
                if (typeof directField === 'object' && directField !== null) {
                    return directField as T;
                } else if (typeof directField === 'string') {
                    const parsed = parseFn(directField);
                    if (parsed) return parsed;
                }
            }
            
            // Fallback to outputs_json
            if (outputsKey && outputs[outputsKey]) {
                const outputValue = outputs[outputsKey];
                if (typeof outputValue === 'object' && outputValue !== null) {
                    return outputValue as T;
                } else if (typeof outputValue === 'string') {
                    const parsed = parseFn(outputValue);
                    if (parsed) return parsed;
                }
            }
            
            return null;
        };

        // Parse interview_points - check both interview_points field and outputs_json.talking_points or outputs_json.bullets
        let interviewPoints: TalkingPlaybookJSON | null = null;
        
        // First check if interview_points is an object with a bullets property (common structure)
        if (draft.interview_points && typeof draft.interview_points === 'object' && draft.interview_points !== null) {
            const ip = draft.interview_points as Record<string, unknown>;
            // Check if it has a bullets property (which contains the actual JSON string)
            if ('bullets' in ip && typeof ip.bullets === 'string') {
                const parsedBullets = parseField<TalkingPlaybookJSON>(ip.bullets);
                if (parsedBullets && typeof parsedBullets === 'object' && 
                    ('strengths' in parsedBullets || 'gaps' in parsedBullets || 'interview_questions' in parsedBullets)) {
                    interviewPoints = parsedBullets;
                }
            } else if ('strengths' in ip || 'gaps' in ip || 'interview_questions' in ip) {
                // Already parsed interview points structure
                interviewPoints = ip as unknown as TalkingPlaybookJSON;
            }
        } else if (typeof draft.interview_points === 'string') {
            // If it's a string, try to parse it
            const parsed = parseField<TalkingPlaybookJSON>(draft.interview_points);
            if (parsed && typeof parsed === 'object' && 
                ('strengths' in parsed || 'gaps' in parsed || 'interview_questions' in parsed)) {
                interviewPoints = parsed;
            }
        }
        
        // If not found, check outputs_json.talking_points
        if (!interviewPoints) {
            interviewPoints = parseFieldFromDraft<TalkingPlaybookJSON>(
                null,
                'talking_points',
                (val) => parseField<TalkingPlaybookJSON>(val)
            );
        }
        
        // If still not found, check outputs_json.bullets - but verify it's interview points structure
        if (!interviewPoints && outputs && outputs.bullets) {
            const bulletsValue = outputs.bullets;
            if (typeof bulletsValue === 'string') {
                const parsedBullets = parseField<Record<string, unknown>>(bulletsValue);
                // Check if it looks like interview points (has strengths, gaps, interview_questions)
                // vs resume bullets (has bullets array)
                if (parsedBullets && typeof parsedBullets === 'object' && parsedBullets !== null &&
                    ('strengths' in parsedBullets || 'gaps' in parsedBullets || 'interview_questions' in parsedBullets)) {
                    interviewPoints = parsedBullets as unknown as TalkingPlaybookJSON;
                }
            } else if (typeof bulletsValue === 'object' && bulletsValue !== null) {
                // Already parsed, check if it's interview points
                const bulletsObj = bulletsValue as Record<string, unknown>;
                if ('strengths' in bulletsObj || 'gaps' in bulletsObj || 'interview_questions' in bulletsObj) {
                    interviewPoints = bulletsValue as TalkingPlaybookJSON;
                }
            }
        }
        
        if (interviewPoints) {
            parsed.interview_points = interviewPoints;
        }

        // Parse resume_bullets - check both resume_bullets field and outputs_json.bullets
        const resumeBullets = parseFieldFromDraft<unknown>(
            draft.resume_bullets,
            'bullets',
            (val) => parseField<unknown>(val)
        );
        
        if (resumeBullets) {
            parsed.resume_bullets = resumeBullets as { bullets: ResumeBullets[] } | ResumeBullets[];
        }

        // Parse cover_letter
        // First check direct cover_letter field - it might be a string that needs parsing
        let coverLetter: CoverLetterJSON | null = null;
        
        if (draft.cover_letter) {
            if (typeof draft.cover_letter === 'object' && draft.cover_letter !== null) {
                // Already an object, check if it's a cover letter
                const cl = draft.cover_letter as unknown as Record<string, unknown>;
                if ('subject' in cl && 'body_paragraphs' in cl) {
                    coverLetter = cl as unknown as CoverLetterJSON;
                }
            } else if (typeof draft.cover_letter === 'string') {
                // Parse from string (might have markdown code blocks)
                const parsed = parseField<CoverLetterJSON>(draft.cover_letter);
                if (parsed && typeof parsed === 'object' && 'subject' in parsed && 'body_paragraphs' in parsed) {
                    coverLetter = parsed;
                }
            }
        }
        
        // Also check outputs_json.bullets - sometimes cover letter is stored there
        if (!coverLetter && outputs && outputs.bullets) {
            const bulletsValue = outputs.bullets;
            if (typeof bulletsValue === 'string') {
                const parsedBullets = parseField<Record<string, unknown>>(bulletsValue);
                // Check if it looks like a cover letter (has cover letter structure)
                if (parsedBullets && typeof parsedBullets === 'object' && parsedBullets !== null &&
                    'subject' in parsedBullets && 'body_paragraphs' in parsedBullets) {
                    coverLetter = parsedBullets as unknown as CoverLetterJSON;
                }
            } else if (typeof bulletsValue === 'object' && bulletsValue !== null) {
                // Already parsed, check if it's a cover letter
                const bulletsObj = bulletsValue as Record<string, unknown>;
                if ('subject' in bulletsObj && 'body_paragraphs' in bulletsObj) {
                    coverLetter = bulletsValue as CoverLetterJSON;
                }
            }
        }
        
        // Also check outputs_json.cover_letter
        if (!coverLetter && outputs && outputs.cover_letter) {
            const clOutput = outputs.cover_letter;
            if (typeof clOutput === 'object' && clOutput !== null) {
                if ('subject' in clOutput && 'body_paragraphs' in clOutput) {
                    coverLetter = clOutput as CoverLetterJSON;
                }
            } else if (typeof clOutput === 'string') {
                const parsed = parseField<CoverLetterJSON>(clOutput);
                if (parsed && typeof parsed === 'object' && 'subject' in parsed && 'body_paragraphs' in parsed) {
                    coverLetter = parsed;
                }
            }
        }
        
        if (coverLetter) {
            parsed.cover_letter = coverLetter;
        }

        // Parse ats_alignment - check if it's an object with a bullets property (like interview_points)
        let atsAlignment: AlignmentJSON | null = null;
        
        // First check if ats_alignment is an object with a bullets property (common structure)
        if (draft.ats_alignment && typeof draft.ats_alignment === 'object' && draft.ats_alignment !== null) {
            const ats = draft.ats_alignment as unknown as Record<string, unknown>;
            // Check if it has a bullets property (which contains the actual JSON string)
            if ('bullets' in ats && typeof ats.bullets === 'string') {
                const parsedBullets = parseField<Record<string, unknown>>(ats.bullets);
                // Check if it looks like ATS alignment structure (has summary, coverage, strengths, gaps)
                if (parsedBullets && typeof parsedBullets === 'object' && parsedBullets !== null &&
                    'summary' in parsedBullets && 'coverage' in parsedBullets) {
                    atsAlignment = parsedBullets as unknown as AlignmentJSON;
                }
            } else if ('summary' in ats && 'coverage' in ats) {
                // Already parsed ATS alignment structure
                atsAlignment = ats as unknown as AlignmentJSON;
            }
        } else if (typeof draft.ats_alignment === 'string') {
            // If it's a string, try to parse it
            const parsed = parseField<Record<string, unknown>>(draft.ats_alignment);
            if (parsed && typeof parsed === 'object' && parsed !== null && 'summary' in parsed && 'coverage' in parsed) {
                atsAlignment = parsed as unknown as AlignmentJSON;
            }
        }
        
        // If not found, check outputs_json.ats_alignment
        if (!atsAlignment) {
            const parsedAts = parseFieldFromDraft<Record<string, unknown>>(
                null,
                'ats_alignment',
                (val) => parseField<Record<string, unknown>>(val)
            );
            if (parsedAts && typeof parsedAts === 'object' && parsedAts !== null && 'summary' in parsedAts && 'coverage' in parsedAts) {
                atsAlignment = parsedAts as unknown as AlignmentJSON;
            }
        }
        
        if (atsAlignment) {
            parsed.ats_alignment = atsAlignment;
        }

        // Parse first_impression
        const firstImpression = parseFieldFromDraft<Record<string, unknown>>(
            draft.first_impression,
            'first_impression',
            (val) => parseField<Record<string, unknown>>(val)
        );
        
        if (firstImpression) {
            parsed.first_impression = firstImpression;
        }

        // Parse bender_score_data
        const benderScoreData = parseFieldFromDraft<Record<string, unknown>>(
            draft.bender_score_data,
            'bender_score_data',
            (val) => parseField<Record<string, unknown>>(val)
        );
        if (benderScoreData) {
            parsed.bender_score_data = benderScoreData;
        }

        return parsed;
    }, [draft]);

    const handleDeleteClick = () => {
        setShowConfirmDelete(true);
    };

    const handleConfirmDelete = async () => {
        setShowConfirmDelete(false);
        setDeleting(true);
        try {
            await deleteHistoryDraft(id);
            // Redirect to history list after successful deletion
            router.push("/draft-history");
        } catch (error) {
            console.error("Failed to delete draft:", error);
            alert("Failed to delete draft. Please try again.");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-muted-foreground">Loading draft...</div>
            </div>
        );
    }

    if (!draft) {
        return (
            <main className="flex-1 px-4 py-8 text-center">
                <h2 className="text-xl font-bold text-foreground">Draft not found</h2>
                <Link href="/draft-history" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline">
                    &larr; Back to History
                </Link>
            </main>
        );
    }

    // Use parsed draft if available, otherwise fall back to original
    const displayDraft = parsedDraft || draft;

    return (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6">
                    <Link href="/draft-history" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        &larr; Back to History
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{displayDraft.job_title || "Untitled Draft"}</h1>
                            {displayDraft.company_name && <p className="text-muted-foreground">{displayDraft.company_name}</p>}
                            {displayDraft.created_at && <p className="text-xs text-muted-foreground/70 mt-1">Generated {new Date(displayDraft.created_at).toLocaleString()}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {displayDraft.bender_score && (
                                <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${getScoreColorClasses(displayDraft.bender_score)}`}>
                                    <span>Bender Score:</span>
                                    <span className="text-lg">{Math.round(displayDraft.bender_score)}</span>
                                </div>
                            )}
                            <button
                                onClick={handleDeleteClick}
                                disabled={deleting}
                                className="inline-flex items-center justify-center rounded-md border border-destructive bg-background p-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                                title="Delete draft"
                                aria-label="Delete draft"
                            >
                                {deleting ? (
                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">

                    {/* Resume Bullets */}
                    {!!displayDraft.resume_bullets && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">Resume Bullets</h2>
                            <BulletsView data={Array.isArray(displayDraft.resume_bullets) ? { bullets: displayDraft.resume_bullets } : displayDraft.resume_bullets} />
                        </section>
                    )}

                    {/* Talking Points / Interview */}
                    {!!displayDraft.interview_points && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">Talking Points & Interview Prep</h2>
                            <TalkingPlaybookView data={displayDraft.interview_points as unknown as TalkingPlaybookJSON | string} />
                        </section>
                    )}

                    {/* Cover Letter */}
                    {!!displayDraft.cover_letter && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">Cover Letter</h2>
                            <CoverLetterView 
                                data={displayDraft.cover_letter as unknown as CoverLetterJSON | string}
                                showResetWarning={true}
                            />
                        </section>
                    )}

                    {/* ATS Alignment */}
                    {!!displayDraft.ats_alignment && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">ATS Alignment</h2>
                            <AlignmentView data={displayDraft.ats_alignment} />
                        </section>
                    )}

                    {/* Bender Score */}
                    {displayDraft.bender_score !== undefined && displayDraft.bender_score !== null && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">Bender Score</h2>
                            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`text-4xl font-bold ${getScoreTextColor(displayDraft.bender_score)}`}>
                                        {Math.round(displayDraft.bender_score)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Overall match score for this application
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Bender Score Data (detailed) */}
                    {!!displayDraft.bender_score_data && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">Bender Score (beta)</h2>
                            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                {typeof displayDraft.bender_score_data === 'object' ? (
                                    <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                                        {JSON.stringify(displayDraft.bender_score_data, null, 2)}
                                    </pre>
                                ) : (
                                    <p className="text-foreground">{String(displayDraft.bender_score_data)}</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* First Impression */}
                    {!!displayDraft.first_impression && (
                        <section>
                            <h2 className="text-lg font-bold mb-3 text-foreground">First Impression</h2>
                            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                {typeof displayDraft.first_impression === 'object' ? (
                                    <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                                        {JSON.stringify(displayDraft.first_impression, null, 2)}
                                    </pre>
                                ) : (
                                    <p className="text-foreground">{String(displayDraft.first_impression)}</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Empty State if nothing detailed is found but output_json exists? */}
                    {!displayDraft.resume_bullets && !displayDraft.interview_points && !displayDraft.cover_letter && !displayDraft.ats_alignment && !displayDraft.first_impression && (
                        <div className="rounded-xl border border-border bg-card p-6">
                            <p className="text-muted-foreground">No structured components found for this draft.</p>
                            {displayDraft.outputs_json && (
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">View Raw Output</summary>
                                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs text-foreground font-mono">
                                        {JSON.stringify(displayDraft.outputs_json, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    )}

                </div>
            
            <ConfirmDialog
                open={showConfirmDelete}
                title="Delete Draft"
                message="Are you sure you want to delete this draft? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowConfirmDelete(false)}
            />
            </main>
    );
}

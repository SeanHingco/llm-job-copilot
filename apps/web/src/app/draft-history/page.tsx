"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getHistoryList, deleteHistoryDraft } from "../../lib/api";
import { Draft } from "../../lib/types";
import ConfirmDialog from "components/ConfirmDialog";

// Helper function to get color classes based on score
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

export default function DraftHistoryListPage() {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ draftId: string } | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const list = await getHistoryList();
                console.log('[DraftHistoryList] Loaded drafts:', list);
                console.log('[DraftHistoryList] Draft client_ref_ids:', list.map(d => ({ client_ref_id: d.client_ref_id, hasClientRefId: !!d.client_ref_id })));
                setDrafts(list);
            } catch (e) {
                console.error("Failed to load history", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleDeleteClick = (draftId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDelete({ draftId });
    };

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return;
        
        const draftId = confirmDelete.draftId;
        setConfirmDelete(null);
        setDeleting(draftId);
        
        try {
            await deleteHistoryDraft(draftId);
            // Remove from local state
            setDrafts(drafts.filter(d => d.client_ref_id !== draftId));
        } catch (error) {
            console.error("Failed to delete draft:", error);
            alert("Failed to delete draft. Please try again.");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">History</h1>
                <p className="text-muted-foreground">Past resumes you&apos;ve bended.</p>
            </div>

            {loading ? (
                <div className="py-12 text-center text-muted-foreground">Loading history...</div>
            ) : drafts.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-foreground">No drafts yet</h3>
                    <p className="mt-1 text-muted-foreground">Create your first resume draft to get started.</p>
                    <div className="mt-6">
                        <Link href="/draft" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                            New Draft
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {drafts.map((draft) => {
                        // Use client_ref_id as the primary identifier (it's the actual primary key)
                        const draftId = draft.client_ref_id;
                        const hasValidId = draftId && draftId !== '#';
                        const targetPath = hasValidId ? `/draft-history/${draftId}` : null;

                        const cardContent = (
                            <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md">
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            {new Date(draft.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {draft.bender_score ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getScoreColorClasses(draft.bender_score)}`}>
                                                    Score: {Math.round(draft.bender_score)}
                                                </span>
                                            ) : null}
                                            {hasValidId && (
                                                <button
                                                    onClick={(e) => handleDeleteClick(draftId, e)}
                                                    disabled={deleting === draftId}
                                                    className="rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                                                    title="Delete draft"
                                                    aria-label="Delete draft"
                                                >
                                                    {deleting === draftId ? (
                                                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                    ) : (
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2">
                                        {draft.job_title || "Untitled Draft"}
                                    </h3>
                                    {draft.company_name && (
                                        <p className="text-sm text-muted-foreground">{draft.company_name}</p>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-1">
                                        {/* Show badges for what's inside */}
                                        {draft.resume_bullets && <Badge>Bullets</Badge>}
                                        {draft.cover_letter && <Badge>Cover Letter</Badge>}
                                        {draft.interview_points && <Badge>Interview</Badge>}
                                        {draft.ats_alignment && <Badge>ATS</Badge>}
                                    </div>
                                </div>
                            </div>
                        );

                        if (!hasValidId || !targetPath) {
                            return (
                                <div key={draft.client_ref_id || draft.created_at}>
                                    {cardContent}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={draft.client_ref_id}
                                href={targetPath}
                                className="block no-underline cursor-pointer"
                                onClick={(e) => {
                                    console.log('[DraftHistoryList] Link clicked!', { 
                                        client_ref_id: draft.client_ref_id, 
                                        targetPath,
                                        href: (e.currentTarget as HTMLAnchorElement).href
                                    });
                                }}
                                onMouseEnter={() => {
                                    console.log('[DraftHistoryList] Hovering over card with client_ref_id:', draft.client_ref_id);
                                }}
                            >
                                {cardContent}
                            </Link>
                        );
                    })}
                </div>
            )}
            
            <ConfirmDialog
                open={confirmDelete !== null}
                title="Delete Draft"
                message="Are you sure you want to delete this draft? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        </main>
    );
}

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/50">
            {children}
        </span>
    );
}

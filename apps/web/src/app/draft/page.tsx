"use client"
import {useState, useEffect} from "react";
import { apiFetch } from '@/lib/api';
import CreditBadge from 'components/CreditBadge'
// import SignOutButton from "components/SignOutButton";
import { useRequireAuth } from "@/lib/RequireAuth";
import { supabase } from '@/lib/supabaseClient';
// import ChangePasswordForm from "components/ChangePasswordForm";
// import Link from 'next/link'
import { ApiResponse } from "@/lib/api";

// types
type Task = "bullets" | "talking_points" | "cover_letter" | "alignment";

// type Meta = { remaining_credits?: number };

type BulletsJSON = { bullets: { text: string; job_chunks?: number[] }[] };

type TalkingJSON = {
  points: { type?: "strength" | "emphasis" | "reminder"; text: string; job_chunks?: number[] }[];
  notes?: string[];
};

type CoverJSON = {
  subject: string;
  greeting: string;
  body_paragraphs: string[];
  valediction: string;
  signature: string;
};

type AlignJSON = {
  summary: string;
  coverage: number;
  strengths: { requirement: string; evidence_resume?: string; job_chunks?: number[] }[];
  gaps: { requirement: string; why_it_matters?: string; suggested_edit?: string }[];
  missing_keywords?: string[];
  suggested_edits?: { type: string; before?: string; after: string; note?: string }[];
  questions_for_candidate?: string[];
};

type AnyJSON = BulletsJSON | TalkingJSON | CoverJSON | AlignJSON;

type TaskPhase = "queued" | "running" | "done" | "error";
type TaskStatus = { phase: TaskPhase; message?: string };
type TaskResult = { json: AnyJSON | null; raw: string };

type RunFormResponse = {
  output_json?: AnyJSON | null;
  output?: string | null;
  bullets?: string | null;
  prompt?: string | null;
  meta?: Record<string, unknown>;
};

type ErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
};

type ExtractResponse = {
  text?: string;
  text_length?: number;
  probably_scanned?: boolean;
};

export type PriceKey = 'pack_100' | 'pack_500' | 'sub_starter' | 'sub_plus' | 'sub_pro';

// Simple credits meta we actually read
type CreditsMeta = { remaining_credits?: number; [k: string]: unknown };

// Success payload for /draft/run-form
type RunFormOk = {
  output_json?: AnyJSON | null;
  output?: string | null;
  bullets?: string | null;
  prompt?: string | null;
  meta?: CreditsMeta;
};

type ApiError = {
  detail?: string | { message?: string } | unknown;
  message?: string;
  code?: string;
  current_credits?: number;
};

export type RunFormPayload = RunFormOk | ApiError;

export type AccountCreditsResponse = { remaining_credits: number };
export type SpendResponse = { ok: true; free_uses_remaining: number };
export type CheckoutResponse = { url: string };
export type CheckoutStatusResponse = {
  ok: boolean; paid: boolean; status?: string;
  email?: string; mode?: 'payment'|'subscription';
  subscription_id?: string | null;
};
export type CompleteSubscriptionResponse = {
  ok: true; plan: string; credited: number; user: { free_uses_remaining: number; plan: string };
};

// helpers
const TASK_OPTIONS: { key: Task; label: string }[] = [
  { key: "bullets",         label: "Resume Bullets" },
  { key: "talking_points",  label: "Talking Points" },
  { key: "cover_letter",    label: "Cover Letter" },
  { key: "alignment",       label: "Alignment" },
];

function errorToMessage(status: number, body: ErrorBody): string {
  const detailText = asText(body?.detail ?? body?.message ?? body?.error ?? "");

  if (status === 401) return detailText || "You’re signed out. Please sign in.";
  if (status === 402) return detailText || "You’re out of credits. Upgrade to continue.";
  if (status === 0)   return "Network error. Check your connection and try again.";
  if (status >= 500)  return "Something went wrong on our side. Please try again.";
  if (status === 429) return detailText || "Too many requests. Please wait a moment.";

  if (status >= 400)  return detailText || `Request failed (${status}).`;
  return detailText || "Unexpected error.";
}

function asText(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") {
    const obj = x as Record<string, unknown>;
    const msg = obj.message;
    const det = obj.detail;
    if (typeof msg === "string") return msg;
    if (typeof det === "string") return det;
    try { return JSON.stringify(x); } catch { /* ignore */ }
  }
  return String(x);
}

function hasCreditsMeta(x: unknown): x is { meta: CreditsMeta } {
  return !!x && typeof x === 'object' && 'meta' in x;
}

function isApiError(x: unknown): x is ApiError {
  return isObject(x) && ("detail" in x || "message" in x || "error" in x);
}

function isRunFormOk(x: unknown): x is RunFormOk {
  return isObject(x) && ("output_json" in x || "output" in x || "bullets" in x);
}

function errToString(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// type guarding
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function isBullets(j: unknown): j is BulletsJSON {
  return isObject(j) && Array.isArray((j as { bullets?: unknown }).bullets);
}
function isTalking(j: unknown): j is TalkingJSON {
  return isObject(j) && Array.isArray((j as { points?: unknown }).points);
}
function isCover(j: unknown): j is CoverJSON {
  return (
    isObject(j) &&
    typeof (j as { subject?: unknown }).subject === "string" &&
    Array.isArray((j as { body_paragraphs?: unknown }).body_paragraphs)
  );
}
function isAlign(j: unknown): j is AlignJSON {
  return (
    isObject(j) &&
    typeof (j as { coverage?: unknown }).coverage === "number" &&
    Array.isArray((j as { strengths?: unknown }).strengths)
  );
}




export default function DraftPage() {
    // initialize states
    const[url, setUrl] = useState<string>("");
    const[q, setQ] = useState<string>("");
    const[jobTitle, setJobTitle] = useState<string>("");
    const[resumeText, setResumeText] = useState("");
    const[resumeFile, setResumeFile] = useState<File | null>(null);
    const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
    const[status, setStatus] = useState<string>("");
    const[error, setError] = useState<string>("");
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [probablyScanned, setProbablyScanned] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [bullets, setBullets] = useState<string>("");
    const [genError, setGenError] = useState<string>("");
    const [result, setResult] = useState<{
        task: Task;
        json: AnyJSON | null;
        raw: string;
    } | null>(null);
    const [results, setResults] = useState<Partial<Record<Task, TaskResult>>>({});
    const [taskStatus, setTaskStatus] = useState<Partial<Record<Task, TaskStatus>>>({});
    const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
    const [credits, setCredits] = useState<number | undefined>(undefined);
    const [jobText, setJobText] = useState<string>("");

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            console.log('[draft] session?', !!data.session, data.session?.user?.email)
        })
    }, [])

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rb:credits')
            if (raw != null) {
                const n = Number(raw)
                if (Number.isFinite(n)) setCredits(n)
                else localStorage.removeItem('rb:credits')
            }
        } catch {}
    }, [])

    useEffect(() => {
        (async () => {
            const res = await apiFetch<{ remaining_credits?: number }>('/account/credits')
            const n = res.data?.remaining_credits
            if (res.ok && typeof n === 'number') setCreditsCached(n)
        })()
    }, [])


    // check auth
    const { ready } = useRequireAuth()
    if (!ready) return null;

    function setPhase(t: Task, phase: TaskPhase, message?: string) {
        setTaskStatus(prev => ({ ...prev, [t]: { phase, message } }));
    }

    // initialize styling
    const inputBase = "w-full rounded-lg border border-slate-300 bg-black px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const labelBase = "text-sm text-neutral-800 font-medium";

    // set API location
    const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    // initialize task
    function toggleTask(t: Task) {
        setSelectedTasks(prev =>
            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
        );
    }

    function pickTaskToRun(): Task | null {
        if (selectedTasks.length === 0) return null;
        return selectedTasks[0]; // temporary: just the first checked task
    }

    function setCreditsCached(n?: number) {
        setCredits(n)
        try { if (typeof n === 'number') localStorage.setItem('rb:credits', String(n)); } catch {}
    }

    // async function onExtract() {
    //     setError(""); setStatus(""); setProbablyScanned(false);
    //     if (!resumeFile) { setError("Select a .pdf or .txt first."); return; }

    //     setIsExtracting(true);
    //     try {
    //         const fd = new FormData();
    //         fd.append("file", resumeFile);

    //         const res = await apiFetch(`/resume/extract`, {
    //         method: 'POST',
    //         body: fd
    //         });

    //         const data: any = (res as any).data || null;

    //         if (!res.ok) {
    //         const msg = data?.detail || `Extract failed (${res.status})`;
    //         setError(msg);
    //         return;
    //         }

    //         setResumeText(data?.text ?? "");
    //         setStatus(`Extracted • ${data?.text_length ?? 0} chars`);
    //         setProbablyScanned(Boolean(data?.probably_scanned));
    //     } catch (e: any){
    //         setError(e?.message || "Network error");
    //     } finally {
    //         setIsExtracting(false);
    //     }
    // }

    // async function onGenerate() {
    //     setGenError(""); setBullets("");
    //     if (!url) { setGenError("Enter a job URL first."); return; }

    //     setIsGenerating(true);
    //     try {
    //         const body = { url, q: q || null, job_title: jobTitle || null, resume: resumeText || "" };

    //         const res = await apiFetch(`/draft/run`, {       // <-- remove ${API}
    //         method: "POST",
    //         headers: { "content-type": "application/json" },
    //         body: JSON.stringify(body),
    //         });

    //         const data: any = (res as any).data || null;     // <-- read once

    //         // update credits if present
    //         const nextCredits = data?.meta?.remaining_credits;
    //         if (typeof nextCredits === 'number') setCredits(nextCredits);
    //         if (typeof nextCredits === 'number') setCreditsCached(nextCredits);

    //         if (!res.ok) {
    //             // optional: show upgrade banner on 402
    //             if (res.status === 402) {
    //                 setUpgradeMsg(
    //                     asText(data?.detail ?? data) || "You’re out of credits. Upgrade to continue."
    //                 );
    //                 }
    //                 setGenError(errorToMessage(res.status, data));
    //             return;
    //         }

    //         setBullets(data?.bullets ?? "");
    //     } catch (e: any){
    //         setGenError(e?.message || "Network error");
    //     } finally {
    //         setIsGenerating(false);
    //     }
    // }

    async function onGenerateAll() {
        setError(""); setBullets(""); setGenError(""); setResult(null); setResults({});
        setTaskStatus(Object.fromEntries(selectedTasks.map(t => [t, { phase: "queued" }])));

        if (!url && !jobText.trim()) {
            setError("Provide a job URL or paste the job description.");
            return;
        }
        if (selectedTasks.length === 0) { setGenError("Select at least one task."); return; }

        if (typeof credits === 'number' && credits <= 0) {
            const msg = "You’re out of credits. Upgrade to continue.";
            setUpgradeMsg(msg);
            setGenError(msg);
            return;
        }

        setUpgradeMsg(null);
        setIsGenerating(true);
        try {
            for (const taskToRun of selectedTasks) {
            const fd = new FormData();
            if (url) fd.append("url", url);
            if (jobText) fd.append("job_text", jobText);
            fd.append("task", taskToRun);
            if (q) fd.append("q", q);
            if (jobTitle) fd.append("job_title", jobTitle);
            if (resumeFile) fd.append("resume_file", resumeFile);
            else if (resumeText) fd.append("resume", resumeText);

            setPhase(taskToRun, "running");

            const res = await apiFetch<RunFormPayload>('/draft/run-form', { method: 'POST', body: fd });
            const out = res.data;

            // credits
            const nextCredits =
                hasCreditsMeta(out) && typeof out.meta?.remaining_credits === 'number'
                    ? out.meta.remaining_credits
                    : undefined;
            if (typeof nextCredits === 'number') setCredits(nextCredits);
            if (typeof nextCredits === 'number') setCreditsCached(nextCredits);

            if (res.status === 402) {
                const err: ErrorBody = isApiError(out) ? out : {};
                setUpgradeMsg(asText(err.detail ?? err.message ?? err.error ?? ""));
                setGenError(errorToMessage(res.status, err));
                setIsGenerating(false);
                return;
            }

            if (!res.ok) {
                const err: ErrorBody = isApiError(out) ? out : {};
                const msg = errorToMessage(res.status, err);
                setResults(prev => ({ ...prev, [taskToRun]: { json: null, raw: msg } }));
                setPhase(taskToRun, "error", msg);
                continue;
            }

            // Success path
            let parsed: AnyJSON | null = null;
            let raw = "";
            if (isRunFormOk(out)) {
                    const parsedFromKnown = out.output_json ?? null;
                    parsed = parsedFromKnown;

                    if (!parsed) parsed = parseJSON(out.output);
                    if (!parsed) parsed = parseJSON(out.bullets ?? null);

                    if (!parsed && typeof out.bullets === "string") {
                        const txt = out.bullets.trim();
                        if (!(txt.startsWith("{") || txt.startsWith("```"))) {
                        const lines = out.bullets
                            .split(/\r?\n/)
                            .map(line => line.replace(/^[\-\u2022•]\s*/, "").trim())
                            .filter(line => line.length > 0);
                        parsed = { bullets: lines.map(t => ({ text: t })) } as BulletsJSON;
                        }
                    }

                    if (typeof out.output === "string") raw = out.output;
                    else try { raw = JSON.stringify(out, null, 2); } catch { raw = "(no output)"; }
                    } else {
                    // If we somehow got a non-ok shape on a 2xx, stringify it for visibility
                    try { raw = JSON.stringify(out, null, 2); } catch { raw = "(no output)"; }
                    }

                    setResults(prev => ({ ...prev, [taskToRun]: { json: parsed, raw } }));
                    setPhase(taskToRun, "done");
            }
        } catch (e: unknown) {
            setGenError(errToString(e));
        } finally {
            setIsGenerating(false);
        }
    }

    function formatResult(task: Task, r: TaskResult | undefined): string {
        if (!r) return "";
        if (!r.json) return r.raw || "";
        const j = r.json as AnyJSON;

        if (isBullets(j)) {
            console.log("bulleted");
            return j.bullets.map((b, i) => `• ${b.text}${b.job_chunks?.length ? ` [${b.job_chunks.join(",")}]` : ""}`).join("\n");
        }
        if (isTalking(j)) {
            console.log("talking");
            const pts = j.points.map(p => `• (${p.type ?? "point"}) ${p.text}`);
            const notes = (j.notes ?? []).map(n => `note: ${n}`);
            return [...pts, ...notes].join("\n");
        }
        if (isCover(j)) {
            return [
                j.subject,
                "",
                j.greeting,
                "",
                ...j.body_paragraphs,
                "",
                `${j.valediction}`,
                j.signature
            ].join("\n");
        }
        if (isAlign(j)) {
            const header = [`Summary: ${j.summary}`, `Coverage: ${j.coverage}%`];
            const mk = j.missing_keywords?.length ? [`Missing keywords: ${j.missing_keywords.join(", ")}`] : [];
            const strengths = j.strengths.map(s => `+ ${s.requirement}${s.evidence_resume ? ` — ${s.evidence_resume}` : ""}${s.job_chunks?.length ? ` [${s.job_chunks.join(",")}]` : ""}`);
            const gaps = j.gaps.map(g => `- ${g.requirement}${g.why_it_matters ? ` — ${g.why_it_matters}` : ""}${g.suggested_edit ? `\n  suggested: ${g.suggested_edit}` : ""}`);
            return [...header, ...mk, "", "Strengths:", ...strengths, "", "Gaps:", ...gaps].join("\n");
        }

        // fallback: pretty-print unknown JSON
        return JSON.stringify(j, null, 2);
    }


    function parseJSON(s: string | null | undefined): AnyJSON | null {
        if (!s || typeof s !== "string") return null;
        let txt = s.trim();

        // Strip triple backticks (with or without language tag)
        if (txt.startsWith("```")) {
            const parts = txt.split("```");
            if (parts.length >= 3) {
            // parts[1] might be "json\n{...}" or just "{...}"
            const inner = parts[1].trim();
            // If there's a language tag on the first line, drop it
            const nl = inner.indexOf("\n");
            txt = (nl > -1 && /^[a-z]+$/i.test(inner.slice(0, nl).trim()))
                ? inner.slice(nl + 1).trim()
                : inner;
            }
        }
        const firstBrace = txt.indexOf("{");
        const lastBrace  = txt.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
            const candidate = txt.slice(firstBrace, lastBrace + 1);
            try {
            return JSON.parse(candidate) as AnyJSON;
            } catch { /* fall through */ }
        }

        try {
            return JSON.parse(txt) as AnyJSON;
        } catch {
            return null;
        }
    }


    const outOfCredits = typeof credits === 'number' && credits <= 0;
    const canSubmit = (!!url || jobText.trim().length > 0) && !isGenerating && !outOfCredits;

    return (
        <main className="p-8 space-y-4">
            <div className="max-w-3xl mx-auto px-4">
                <div className="mb-3 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Resume Bender</h1>
                    <CreditBadge value={credits} loading={isGenerating} />
                    {/* <SignOutButton />
                    <Link
                        href="/account/password"
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-100"
                    >
                        Change password
                    </Link> */}
                </div>
                <div className="bg-white border rounded-2xl shadow-sm p-6">
                    <form className="grid gap-2" onSubmit={(e) => e.preventDefault()}>
                        <label htmlFor="url" className={labelBase}>Job URL</label>
                        <input
                            id="url"
                            name="url"
                            type="url"
                            placeholder='https://www.example.com'
                            className={inputBase}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />

                        <label htmlFor="job_text" className={labelBase}>Job description (optional)</label>
                        <textarea
                            id="job_text"
                            name="job_text"
                            rows={8}
                            placeholder="Paste the full job description here. If provided, we’ll use this instead of fetching the URL."
                            className={inputBase}
                            value={jobText}
                            onChange={(e) => setJobText(e.target.value)}
                        />
                        <small className="text-neutral-500">
                            You can provide a URL, paste the description, or both. If pasted, we’ll ignore the URL fetch.
                        </small>

                        <label htmlFor="job_title" className={labelBase}>Job title (optional)</label>
                        <input
                            id="jobTitle"
                            name="job_title"
                            type="text"
                            placeholder='Job title'
                            className={inputBase}
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                        />
                        
                        <label className={labelBase}>Tasks</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {TASK_OPTIONS.map(opt => {
                                const st = taskStatus[opt.key]?.phase;
                                return (
                                    <label key={opt.key} className="inline-flex items-center gap-2 text-sm text-neutral-800">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300"
                                            checked={selectedTasks.includes(opt.key)}
                                            onChange={() => toggleTask(opt.key)}
                                        />
                                        <span>{opt.label}</span>

                                        {st === "running" && (
                                            <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" aria-label="Generating" />
                                        )}
                                        {st === "queued" && (
                                            <span className="text-xs text-neutral-500">Queued</span>
                                        )}
                                        {st === "done" && (
                                            <span className="text-xs font-medium text-green-600">Done</span>
                                        )}
                                        {st === "error" && (
                                            <span className="text-xs font-medium text-red-600" title={taskStatus[opt.key]?.message}>
                                            Error
                                            </span>
                                        )}
                                    </label>
                                );
                                })}
                        </div>
                        <small className="text-neutral-500">
                            Select one or more tasks to run.
                        </small>


                        <label htmlFor="resume" className={labelBase}>Resume text (optional)</label>
                        <textarea
                            id="resume"
                            name="resume"
                            placeholder="Resume"
                            rows={6}
                            className={inputBase}
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                        >
                        </textarea>

                        <label htmlFor="resume_file" className={labelBase}>Resume file (PDF/TXT)</label>
                        <input
                            id="resumeFile"
                            name="resume_file"
                            type="file"
                            accept=".pdf,.txt" 
                            placeholder="Upload Resume File"
                            className="block w-full text-neutral-800 text-sm file:cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-slate-200"
                            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                        />
                        {/* {resumeFile && <small>Selected: {resumeFile.name}</small>} */}

                        {/* Submit */}
                        <button 
                            type="button" 
                            onClick={onGenerateAll}
                            className="inline-flex justify-center items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!canSubmit}>
                            {outOfCredits ? "Out of credits" : (isGenerating ? "Generating…" : "Get Resume Insights")}
                        </button>
                    </form>
                </div>
                {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
                {genError && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {genError}
                    </div>
                )}
                {status && <p>{status}</p>}
                {typeof credits === 'number' && credits <= 0 && !upgradeMsg && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        You’re out of credits. <a className="underline" href="/account/billing">Upgrade</a> to continue.
                    </div>
                )}

                {upgradeMsg && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm flex items-center justify-between gap-3"
                    >
                        <span>{asText(upgradeMsg)}</span>
                        <a
                        href="/account/billing"
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                        Upgrade
                        </a>
                    </div>
                )}
                {Object.keys(results).length > 0 && (
                    <div className="mt-6 space-y-6">
                        {(Object.keys(results) as Task[]).map(t => {
                        const r = results[t];
                        const title =
                            t === "bullets" ? "Resume Bullets" :
                            t === "talking_points" ? "Talking Points" :
                            t === "cover_letter" ? "Cover Letter" : "Alignment";
                        return (
                            <section key={t}>
                            <h2 className="text-lg font-bold mb-2">{title}</h2>
                            <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                {formatResult(t, r)}
                            </pre>
                            </section>
                        );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
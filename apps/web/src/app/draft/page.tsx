"use client"
import {useState, useEffect} from "react";
import { apiFetch } from '@/lib/api';
import CreditBadge from 'components/CreditBadge'
import SignOutButton from "components/SignOutButton";
import { useRequireAuth } from "@/lib/RequireAuth";
import { supabase } from '@/lib/supabaseClient';
import ChangePasswordForm from "components/ChangePasswordForm";
import Link from 'next/link'

// types
type Task = "bullets" | "talking_points" | "cover_letter" | "alignment";

type Meta = { remaining_credits?: number };

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

// helpers
const TASK_OPTIONS: { key: Task; label: string }[] = [
  { key: "bullets",         label: "Resume Bullets" },
  { key: "talking_points",  label: "Talking Points" },
  { key: "cover_letter",    label: "Cover Letter" },
  { key: "alignment",       label: "Alignment" },
];

function errorToMessage(status: number, body: any): string {
  const detailText = asText(body?.detail ?? body?.message ?? body?.error ?? "");

  if (status === 401) return detailText || "You’re signed out. Please sign in.";
  if (status === 402) return detailText || "You’re out of credits. Upgrade to continue.";
  if (status === 0)   return "Network error. Check your connection and try again.";
  if (status >= 500)  return "Something went wrong on our side. Please try again.";

  if (status >= 400)  return detailText || `Request failed (${status}).`;
  return detailText || "Unexpected error.";
}

function asText(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x?.message === "string") return x.message;
  if (typeof x?.detail === "string") return x.detail;
  try { return JSON.stringify(x); } catch { return String(x); }
}

// type guarding
function isBullets(j: AnyJSON): j is BulletsJSON {
  return !!(j as any)?.bullets;
}
function isTalking(j: AnyJSON): j is TalkingJSON {
  return !!(j as any)?.points;
}
function isCover(j: AnyJSON): j is CoverJSON {
  const x = j as any;
  return typeof x?.subject === "string" && Array.isArray(x?.body_paragraphs);
}
function isAlign(j: AnyJSON): j is AlignJSON {
  const x = j as any;
  return typeof x?.coverage === "number" && Array.isArray(x?.strengths);
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

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            console.log('[draft] session?', !!data.session, data.session?.user?.email)
        })
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

    async function onExtract() {
        setError(""); setStatus(""); setProbablyScanned(false);
        if (!resumeFile) { setError("Select a .pdf or .txt first."); return; }

        setIsExtracting(true);
        try {
            const fd = new FormData();
            fd.append("file", resumeFile);

            const res = await apiFetch(`/resume/extract`, {
            method: 'POST',
            body: fd
            });

            const data: any = (res as any).data || null;

            if (!res.ok) {
            const msg = data?.detail || `Extract failed (${res.status})`;
            setError(msg);
            return;
            }

            setResumeText(data?.text ?? "");
            setStatus(`Extracted • ${data?.text_length ?? 0} chars`);
            setProbablyScanned(Boolean(data?.probably_scanned));
        } catch (e: any){
            setError(e?.message || "Network error");
        } finally {
            setIsExtracting(false);
        }
    }

    async function onGenerate() {
        setGenError(""); setBullets("");
        if (!url) { setGenError("Enter a job URL first."); return; }

        setIsGenerating(true);
        try {
            const body = { url, q: q || null, job_title: jobTitle || null, resume: resumeText || "" };

            const res = await apiFetch(`/draft/run`, {       // <-- remove ${API}
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            });

            const data: any = (res as any).data || null;     // <-- read once

            // update credits if present
            const nextCredits = data?.meta?.remaining_credits;
            if (typeof nextCredits === 'number') setCredits(nextCredits);

            if (!res.ok) {
                // optional: show upgrade banner on 402
                if (res.status === 402) {
                    setUpgradeMsg(
                        asText(data?.detail ?? data) || "You’re out of credits. Upgrade to continue."
                    );
                    }
                    setGenError(errorToMessage(res.status, data));
                return;
            }

            setBullets(data?.bullets ?? "");
        } catch (e: any){
            setGenError(e?.message || "Network error");
        } finally {
            setIsGenerating(false);
        }
    }

    async function onGenerateAll() {
        setError(""); setBullets(""); setGenError(""); setResult(null); setResults({});
        setTaskStatus(Object.fromEntries(selectedTasks.map(t => [t, { phase: "queued" }])));

        if (!url) { setGenError("Enter a job URL first."); return; }
        if (selectedTasks.length === 0) { setGenError("Select at least one task."); return; }

        if (credits === 0) {
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
            fd.append("url", url);
            fd.append("task", taskToRun);
            if (q) fd.append("q", q);
            if (jobTitle) fd.append("job_title", jobTitle);
            if (resumeFile) fd.append("resume_file", resumeFile);
            else if (resumeText) fd.append("resume", resumeText);

            setPhase(taskToRun, "running");

            const res = await apiFetch(`/draft/run-form`, { method: 'POST', body: fd });
            const out: any = (res as any).data || null;    // <-- read once

            // credits
            const nextCredits = out?.meta?.remaining_credits;
            if (typeof nextCredits === 'number') setCredits(nextCredits);

            if (res.status === 402) {
                setUpgradeMsg(
                    asText(out?.detail ?? out) || "You’re out of credits. Upgrade to continue."
                );
                setGenError(errorToMessage(res.status, out));
                setIsGenerating(false);
                return;
            }

            if (!res.ok) {
                const msg = errorToMessage(res.status, out); 
                setResults(prev => ({ ...prev, [taskToRun]: { json: null, raw: msg } }));
                setPhase(taskToRun, "error", msg);
                continue;
            }

            // Success path
            const parsedFromKnown = out?.output_json ?? null;
            let parsed: AnyJSON | null = parsedFromKnown;

            if (!parsed) parsed = parseJSON(out?.output);
            if (!parsed) parsed = parseJSON(out?.bullets ?? null);
            if (!parsed && typeof out?.bullets === "string") {
                const txt = out.bullets.trim();
                if (!(txt.startsWith("{") || txt.startsWith("```"))) {
                const lines = out.bullets
                    .split(/\r?\n/)
                    .map((line: string) => line.replace(/^[\-\u2022•]\s*/, "").trim())
                    .filter((line: string) => line.length > 0);
                parsed = { bullets: lines.map((t: string) => ({ text: t })) } as BulletsJSON;
                }
            }

            let raw = "";
            if (typeof out?.output === "string") raw = out.output;
            else try { raw = JSON.stringify(out, null, 2); } catch { raw = "(no output)"; }

            setResults(prev => ({ ...prev, [taskToRun]: { json: parsed, raw } }));
            setPhase(taskToRun, "done");
            }
        } catch (e: any) {
            setGenError(e?.message || "Network error");
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


    const outOfCredits = credits === 0;
    const canSubmit = !!url && !isGenerating && !outOfCredits;
    return (
        <main className="p-8 space-y-4">
            <div className="max-w-3xl mx-auto px-4">
                <div className="mb-3 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Resume Bender</h1>
                    <CreditBadge value={credits} loading={isGenerating} />
                    <SignOutButton />
                    <Link
                        href="/account/password"
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-100"
                    >
                        Change password
                    </Link>
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

                        <label htmlFor="q" className={labelBase}>Query (optional)</label>
                        <input
                            id="q"
                            name="q"
                            type="text"
                            placeholder='What are you looking for? e.g. "requirements responsibilities"'
                            className={inputBase}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />

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
"use client"
import {useState, useEffect} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from '@/lib/api';
import CreditBadge from 'components/CreditBadge'
// import SignOutButton from "components/SignOutButton";
import { useRequireAuth } from "@/lib/RequireAuth";
import { supabase } from '@/lib/supabaseClient';
// import ChangePasswordForm from "components/ChangePasswordForm";
// import Link from 'next/link'
import { ApiResponse } from "@/lib/api";
import TutorialModal from "components/TutorialModal";
import Tooltip from "components/Tooltip";
import BulletsView from "components/BulletsView";
import PercentRing from "components/PercentRing";
import TalkingPlaybookView from "components/TalkingPlaybookView";
import AlignmentView from "components/AlignmentView";
import CoverLetterView from "components/CoverLetterView";
import FinalizeReferral from "components/FinalizeReferral";
import { capture } from "@/lib/analytics";
import Head from 'next/head';

const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE === 'true';

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

type AnyJSON = BulletsJSON | TalkingJSON | TalkingPlaybookJSON | CoverJSON | AlignJSON;

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

type TalkingPlaybookJSON = {
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

export type AccountCreditsResponse = {
  remaining_credits: number;
  plan: 'free' | 'unlimited' | string;
  unlimited: boolean;
  premium?: {
    active: boolean;
    expires_at?: string;   // ISO
    days_left?: number;    // integer
  };
};
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
const TUT_KEY = "rb:tutorial_seen";
function markTutorialSeen() {
  try { localStorage.setItem(TUT_KEY, "1"); } catch {}
}

const TASK_OPTIONS: { key: Task; label: string }[] = [
  { key: "bullets",         label: "Resume Bullets" },
  { key: "talking_points",  label: "Talking Points" },
  { key: "cover_letter",    label: "Cover Letter" },
  { key: "alignment",       label: "Alignment" },
];

const TASK_DETAILS: Record<Task, { info: string; cost: number }> = {
  bullets: {
    info: "Six impact-focused bullets with evidence, keywords, and ATS hints.",
    cost: 1,
  },
  talking_points: {
    info: "Strengths, gaps with mitigation, and likely interview questions.",
    cost: 1,
  },
  cover_letter: {
    info: "Concise, tailored cover letter draft.",
    cost: 1,
  },
  alignment: {
    info: "Where your resume lines up with the JD and where it doesn’t.",
    cost: 1,
  },
};

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
function isV2BulletItem(v: unknown): v is { text: string; job_chunks?: number[] } {
  if (!isObject(v)) return false;
  const text = v["text"];
  const job_chunks = v["job_chunks"];
  if (typeof text !== "string") return false;
  if (job_chunks !== undefined && !isNumberArray(job_chunks)) return false;
  return true;
}

function looksBulletsV2(j: unknown): boolean {
  if (!isBullets(j)) return false;
  const arr = (j as BulletsJSON).bullets as unknown[];
  // “rich” if any bullet has extra v2 fields
  const rich = arr.some(
    (b) => isObject(b) && ("evidence" in b || "keywords" in b || "rationale" in b || "transferable" in b)
  );
  return (arr.some(isV2Bullet) && rich) || hasAtsSummary(j);
}

function getAtsCoveragePercent(j: unknown): number | null {
  if (!isObject(j)) return null;

  const a =
    (j as Record<string, unknown>)["ats_summary"] ??
    (j as Record<string, unknown>)["atsSummary"];
  if (!isObject(a)) return null;

  const d =
    (a as Record<string, unknown>)["coverage_detail"] ??
    (a as Record<string, unknown>)["coverageDetail"];
  if (!isObject(d)) return null;

  let rateRaw =
    (d as Record<string, unknown>)["coverage_rate"] ??
    (d as Record<string, unknown>)["coverageRate"];

  if (typeof rateRaw === "string") {
    const n = Number(rateRaw);
    if (!Number.isFinite(n)) return null;
    rateRaw = n;
  }
  if (typeof rateRaw !== "number") return null;

  const pct = rateRaw > 1 ? rateRaw : rateRaw * 100; // accept 0..1 or 0..100
  return Math.max(0, Math.min(100, Math.round(pct)));
}



function isTalkingPlaybook(j: unknown): j is TalkingPlaybookJSON {
  if (!isObject(j)) return false;

  const strengths = (j as Record<string, unknown>)["strengths"];
  const gaps = (j as Record<string, unknown>)["gaps"];
  const qs =
    (j as Record<string, unknown>)["interview_questions"] ??
    (j as Record<string, unknown>)["interviewQuestions"];

  const okStrengths =
    Array.isArray(strengths) &&
    strengths.every((s) =>
      isObject(s) && typeof (s as Record<string, unknown>)["requirement"] === "string"
    );

  const okGaps =
    Array.isArray(gaps) &&
    gaps.every((g) =>
      isObject(g) && typeof (g as Record<string, unknown>)["requirement"] === "string"
    );

  const okQs =
    Array.isArray(qs) &&
    qs.every((q) =>
      isObject(q) && typeof (q as Record<string, unknown>)["question"] === "string"
    );

  return okStrengths && okGaps && okQs;
}

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


type TalkingType = "strength" | "emphasis" | "reminder";
const TALKING_TYPES = new Set<TalkingType>(["strength", "emphasis", "reminder"]);
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
function isV2TalkingItem(v: unknown): v is {
  text: string; type?: TalkingType; job_chunks?: number[];
} {
  if (!isV2BulletItem(v)) return false;
  const type = (v as Record<string, unknown>)["type"];
  if (type !== undefined && !(typeof type === "string" && TALKING_TYPES.has(type as TalkingType))) {
    return false;
  }
  return true;
}

function isV2Bullet(v: unknown): v is {
  text: string;
  job_chunks?: number[];
  evidence?: string;
  keywords?: string[];
  rationale?: string;
  transferable?: boolean;
} {
  if (!isObject(v)) return false;
  const text = v["text"];
  if (typeof text !== "string") return false;
  const job_chunks = v["job_chunks"];
  if (job_chunks !== undefined && !isNumberArray(job_chunks)) return false;
  const evidence = v["evidence"];
  if (evidence !== undefined && typeof evidence !== "string") return false;
  const keywords = v["keywords"];
  if (keywords !== undefined && !isStringArray(keywords)) return false;
  const rationale = v["rationale"];
  if (rationale !== undefined && typeof rationale !== "string") return false;
  const transferable = v["transferable"];
  if (transferable !== undefined && typeof transferable !== "boolean") return false;
  return true;
}

function hasAtsSummary(j: unknown): j is {
  ats_summary: {
    covered_keywords?: string[];
    missing_keywords?: string[];
    coverage_detail?: {
      by_keyword?: { keyword: string; count: number; bullets: number[] }[];
      duplicates?: string[];
      coverage_rate?: number;
    };
  };
} {
  if (!isObject(j)) return false;
  const a = j["ats_summary"];
  if (!isObject(a)) return false;
  // Light checks (optional fields allowed)
  if (a["covered_keywords"] !== undefined && !isStringArray(a["covered_keywords"])) return false;
  if (a["missing_keywords"] !== undefined && !isStringArray(a["missing_keywords"])) return false;
  return true;
}

function asStringArray(u: unknown): u is string[] {
  return Array.isArray(u) && u.every((x) => typeof x === "string");
}

function normalizePlaybook(u: unknown): TalkingPlaybookJSON | null {
  if (!isObject(u)) return null;

  const strengthsU = (u as Record<string, unknown>)["strengths"];
  const gapsU = (u as Record<string, unknown>)["gaps"];
  const qsU =
    (u as Record<string, unknown>)["interview_questions"] ??
    (u as Record<string, unknown>)["interviewQuestions"];

  if (!Array.isArray(strengthsU) || !Array.isArray(gapsU) || !Array.isArray(qsU)) {
    return null;
  }

  const strengths = strengthsU
    .filter(isObject)
    .map((s) => {
      const so = s as Record<string, unknown>;
      const requirement = typeof so["requirement"] === "string" ? so["requirement"] : "";
      const evidence = typeof so["evidence"] === "string" ? so["evidence"] : undefined;
      const rationale = typeof so["rationale"] === "string" ? so["rationale"] : undefined;
      return requirement ? { requirement, evidence, rationale } : null;
    })
    .filter(Boolean) as TalkingPlaybookJSON["strengths"];

  const gaps = gapsU
    .filter(isObject)
    .map((g) => {
      const go = g as Record<string, unknown>;
      const requirement = typeof go["requirement"] === "string" ? go["requirement"] : "";
      const rationale = typeof go["rationale"] === "string" ? go["rationale"] : "";
      const mitigation = typeof go["mitigation"] === "string" ? go["mitigation"] : "";
      return requirement ? { requirement, rationale, mitigation } : null;
    })
    .filter(Boolean) as TalkingPlaybookJSON["gaps"];

  const interview_questions = qsU
    .filter(isObject)
    .map((q) => {
      const qo = q as Record<string, unknown>;
      const question = typeof qo["question"] === "string" ? qo["question"] : "";
      const expected_focus =
        typeof qo["expected_focus"] === "string" ? qo["expected_focus"] : undefined;
      const answer_tips = asStringArray(qo["answer_tips"]) ? qo["answer_tips"] : undefined;
      const prep_example =
        typeof qo["prep_example"] === "string" ? qo["prep_example"] : undefined;
      return question ? { question, expected_focus, answer_tips, prep_example } : null;
    })
    .filter(Boolean) as TalkingPlaybookJSON["interview_questions"];

  let summary: TalkingPlaybookJSON["summary"] | undefined;
  const sU = (u as Record<string, unknown>)["summary"];
  if (isObject(sU)) {
    const so = sU as Record<string, unknown>;
    const overall_strengths =
      asStringArray(so["overall_strengths"]) ? so["overall_strengths"]
      : asStringArray(so["overallStrengths"]) ? so["overallStrengths"]
      : undefined;
    const overall_gaps =
      asStringArray(so["overall_gaps"]) ? so["overall_gaps"]
      : asStringArray(so["overallGaps"]) ? so["overallGaps"]
      : undefined;
    const prep_focus =
      asStringArray(so["prep_focus"]) ? so["prep_focus"]
      : asStringArray(so["prepFocus"]) ? so["prepFocus"]
      : undefined;

    summary = { overall_strengths, overall_gaps, prep_focus };
  }

  // minimal threshold so we don't render an empty card
  if (strengths.length || gaps.length || interview_questions.length) {
    return { strengths, gaps, interview_questions, summary };
  }
  return null;
}

function isAlign(j: unknown): j is AlignJSON {
  return (
    isObject(j) &&
    typeof (j as { coverage?: unknown }).coverage === "number" &&
    Array.isArray((j as { strengths?: unknown }).strengths)
  );
}
const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => typeof n === "number");

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

function hasKey<K extends string>(
  o: Record<string, unknown>,
  k: K
): o is Record<K, unknown> & Record<string, unknown> {
  return k in o;
}


// export const metadata = {
//   title: 'Draft — AI Resume Builder & ATS Checks | Resume Bender',
//   description:
//     'One workspace to generate ATS-friendly resume bullets, tailored cover letters, and alignment insights. Paste a job post and get results in minutes.',
//   alternates: { canonical: 'https://resume-bender.seanhing.co/draft' },
// };

export default function DraftPage() {
    // initialize states
    const router = useRouter();
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
    const [showTut, setShowTut] = useState(false);
    const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
    const [premium, setPremium] = useState<{active:boolean; expires_at?:string; days_left?:number} | null>(null);
    const [showReferralPrompt, setShowReferralPrompt] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            console.log('[draft] session?', !!data.session, data.session?.user?.email)
        })
    }, [])

    useEffect(() => {
        try {
            const rawU = localStorage.getItem('rb:is_unlimited');
            if (rawU != null) setIsUnlimited(rawU === 'true');
            console.log(`ayo unlimited is set to ${isUnlimited}`)
        } catch {}
    }, []);

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
      let cancelled = false;
        (async () => {
        const res = await apiFetch<AccountCreditsResponse>('/account/credits')
        if (!res.ok || cancelled) return
        const d = res.data!
        console.log("[credits]", d);

        // cache credits
        setCreditsCached(d.remaining_credits)

        // SAFE premium guard (no undefined access)
        const p = d.premium ?? { active: false as boolean, days_left: null as number | null, expires_at: null as string | null }
        const premiumActive =
          !!p.active ||
          (typeof p.days_left === 'number' && p.days_left > 0) ||
          (!!p.expires_at && Date.parse(p.expires_at) > Date.now())

        setIsUnlimited(Boolean(d.unlimited || premiumActive))
        setPremium(d.premium ?? null)

        try { localStorage.setItem('rb:is_unlimited', String(Boolean(d.unlimited || premiumActive))) } catch {}
      })()
      return () => { cancelled = true }
    }, [])

    useEffect(() => {
        try {
            const seen = localStorage.getItem("rb:tutorial_seen");
            if (!seen) setShowTut(true);
        } catch {}
    }, []);


    // check auth
    const { ready } = useRequireAuth()
    if (!ready) return null;

    function setPhase(t: Task, phase: TaskPhase, message?: string) {
        setTaskStatus(prev => ({ ...prev, [t]: { phase, message } }));
    }

    // initialize styling
    const inputBase = "w-full rounded-lg border border-slate-300 bg-black px-3 py-3 text-base md:py-2.5 md:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
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

    const isPremium = Boolean(premium?.active);
    

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

    function maybeShowReferralNudge() {
      try {
        // const firstDone = localStorage.getItem("rb:first_task_done");
        // const nudgeSeen = localStorage.getItem("rb:referral_nudge_seen");

        // // Only trigger the very first time they ever complete a task
        // if (!firstDone) {
        //   localStorage.setItem("rb:first_task_done", "1");
        //   if (!nudgeSeen) {
        //     setShowReferralPrompt(true);
        //   }
        // }
        setShowReferralPrompt(true);
      } catch {
        // if localStorage explodes, just silently skip
      }
    }

    async function onGenerateAll() {
        capture("task_run_clicked", { tasks: selectedTasks });
        setError(""); setBullets(""); setGenError(""); setResult(null); setResults({});
        setTaskStatus(Object.fromEntries(selectedTasks.map(t => [t, { phase: "queued" }])));

        if (!url && !jobText.trim()) {
            setError("Provide a job URL or paste the job description.");
            return;
        }
        if (selectedTasks.length === 0) { setGenError("Select at least one task."); return; }

        if (!FREE_MODE && !isUnlimited && typeof credits === 'number' && credits <= 0) {
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
            if (jobText) {
              fd.append("job_text", jobText);
            } else if (url) {
              fd.append("url", url);
            }
            fd.append("task", taskToRun);
            if (q) fd.append("q", q);
            if (jobTitle) fd.append("job_title", jobTitle);
            if (resumeText) {
              fd.append("resume", resumeText);
            } else if (resumeFile) {
              fd.append("resume_file", resumeFile);
            }

            setPhase(taskToRun, "running");

            const res = await apiFetch<RunFormPayload>('/draft/run-form', { method: 'POST', body: fd });
            const out = res.data;

            // credits
            const nextCredits =
                hasCreditsMeta(out) && typeof out.meta?.remaining_credits === 'number'
                    ? out.meta.remaining_credits
                    : undefined;
            if (hasCreditsMeta(out) && typeof out.meta?.unlimited === 'boolean') {
                setIsUnlimited(out.meta.unlimited);
                try { localStorage.setItem('rb:is_unlimited', String(out.meta.unlimited)); } catch {}
            }
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
                const fromKnown = out.output_json ?? null;
                parsed = fromKnown;

                if (!parsed) parsed = parseJSON(out.output);
                if (!parsed) parsed = parseJSON(out.bullets ?? null);

                // NEW: last-ditch parse if model stuffed JSON in a string with fences
                if (!parsed && typeof out.bullets === "string") {
                    const extracted = extractJsonFromMarkdownString(out.bullets);
                    const normalized = normalizeAnyJSON(extracted);
                    if (normalized) parsed = normalized;
                }

                raw = typeof out.output === "string" ? out.output : (() => { try { return JSON.stringify(out, null, 2); } catch { return "(no output)"; } })();
            } else {
                try { raw = JSON.stringify(out, null, 2); } catch { raw = "(no output)"; }
            }

                    setResults(prev => ({ ...prev, [taskToRun]: { json: parsed, raw } }));
                    setPhase(taskToRun, "done");
                    maybeShowReferralNudge();
            }
        } catch (e: unknown) {
            setGenError(errToString(e));
        } finally {
            setIsGenerating(false);
        }
    }

    function friendlyFallback(task: Task, raw: string): string {
      // quick hints by task; keep it short + actionable
      const generic = "We couldn’t format this result. Try pasting the job description or re-running.";
      if (task === "cover_letter") {
        return [
          "We couldn’t produce a structured cover letter.",
          "If the job link is JS-only, paste the job description text.",
          "If your resume doesn’t match the role, try a closer role or add a relevant project."
        ].join(" ");
      }
      if (task === "alignment") {
        return "We couldn’t compute alignment. Paste the job description or try a different role.";
      }
      if (task === "bullets") {
        return "We couldn’t format resume bullets. Paste the job description or re-run.";
      }
      if (task === "talking_points") {
        return "We couldn’t format talking points. Paste the job description or re-run.";
      }
      return generic;
    }

    function formatResult(task: Task, r: TaskResult | undefined): string {
        if (!r) return "";
        if (!r.json) {
          // show a friendly explanation in the main panel…
          return friendlyFallback(task, r.raw || "");
        }
        const j = r.json as AnyJSON;

        if (isBullets(j)) {
            // Detect v2 by presence of richer bullet fields or ats_summary
            const arr = j.bullets as unknown[];
            const looksV2 = arr.some(isV2Bullet) && arr.some((b) => isObject(b) && ("evidence" in b || "keywords" in b || "rationale" in b || "transferable" in b))
                            || hasAtsSummary(j);

            if (looksV2) {
                // Render v2 bullets with sub-details
                const lines = (arr.filter(isV2Bullet)).map((b, i) => {
                const top = `• ${b.text}${b.job_chunks?.length ? ` [${b.job_chunks.join(",")}]` : ""}`;
                const evid = b.evidence ? `  evidence: ${b.evidence}` : "";
                const kw   = b.keywords && b.keywords.length ? `  keywords: ${b.keywords.join(", ")}` : "";
                const why  = b.rationale ? `  why: ${b.rationale}` : "";
                const tr   = typeof b.transferable === "boolean" ? `  transferable: ${b.transferable ? "true" : "false"}` : "";
                return [top, evid, kw, why, tr].filter(Boolean).join("\n");
                }).join("\n");

                // Append ATS summary if provided
                let summary = "";
                if (hasAtsSummary(j)) {
                const a = j.ats_summary;
                const covered = a.covered_keywords && a.covered_keywords.length ? `  covered_keywords: ${a.covered_keywords.join(", ")}` : "";
                const missing = a.missing_keywords && a.missing_keywords.length ? `  missing_keywords: ${a.missing_keywords.join(", ")}` : "";
                const rate = isObject(a.coverage_detail) && typeof a.coverage_detail["coverage_rate"] === "number"
                    ? `  coverage_rate: ${String(a.coverage_detail["coverage_rate"])}` : "";
                const bykw = isObject(a.coverage_detail) && Array.isArray(a.coverage_detail["by_keyword"])
                    ? `  by_keyword:\n${(a.coverage_detail["by_keyword"] as Array<Record<string, unknown>>)
                        .map((r) => `    - ${String(r["keyword"])} (count ${String(r["count"])}) bullets: ${Array.isArray(r["bullets"]) ? (r["bullets"] as number[]).join(", ") : ""}`)
                        .join("\n")}`
                    : "";
                const dup = isObject(a.coverage_detail) && isStringArray(a.coverage_detail["duplicates"])
                    ? `  duplicates: ${a.coverage_detail["duplicates"].join(", ")}`
                    : "";
                const parts = [covered, missing, rate, bykw, dup].filter(Boolean);
                if (parts.length) summary = ["", "ATS summary:", ...parts].join("\n");
                }

                return summary ? `${lines}\n${summary}` : lines;
            }

            // Legacy (v1) rendering
            return j.bullets
                .map((b) => `• ${b.text}${b.job_chunks?.length ? ` [${b.job_chunks.join(",")}]` : ""}`)
                .join("\n");
        }
        if (isTalkingPlaybook(j)) {
            const lines: string[] = [];

            lines.push("Strengths:");
            for (const s of j.strengths) {
                const parts = [
                `• ${s.requirement}`,
                s.evidence ? `  evidence: ${s.evidence}` : "",
                s.rationale ? `  why: ${s.rationale}` : "",
                ].filter(Boolean);
                lines.push(parts.join("\n"));
            }

            lines.push("", "Gaps:");
            for (const g of j.gaps) {
                lines.push(`• ${g.requirement}\n  why: ${g.rationale}\n  mitigation: ${g.mitigation}`);
            }

            lines.push("", "Interview questions:");
            for (const q of j.interview_questions) {
                lines.push(
                    `• ${q.question}` +
                    (q.expected_focus ? `\n  focus: ${q.expected_focus}` : "") +
                    (q.answer_tips && q.answer_tips.length ? `\n  tips: ${q.answer_tips.join(" | ")}` : "") +
                    (q.prep_example ? `\n  prep: ${q.prep_example}` : "")
                );
            }

            if (j.summary) {
                const s = j.summary;
                lines.push("");
                lines.push("Summary:");
                if (isStringArray(s.overall_strengths) && s.overall_strengths.length) {
                    lines.push("  overall_strengths:");
                    s.overall_strengths.forEach((x) => lines.push(`    - ${x}`));
                }
                if (isStringArray(s.overall_gaps) && s.overall_gaps.length) {
                    lines.push("  overall_gaps:");
                    s.overall_gaps.forEach((x) => lines.push(`    - ${x}`));
                }
                if (isStringArray(s.prep_focus) && s.prep_focus.length) {
                    lines.push("  prep_focus:");
                    s.prep_focus.forEach((x) => lines.push(`    - ${x}`));
                }
            }

                return lines.join("\n");
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


    function normalizeAnyJSON(obj: unknown): AnyJSON | null {
        if (!isObject(obj)) return null;

        if (isTalkingPlaybook(obj)) {
            // Return as-is; renderer will handle it
            return obj;
        }

        // --- v2 detection: root has `items` array
        if (hasKey(obj, "items") && Array.isArray(obj.items)) {
            const items = obj.items as unknown[];

            // If any item has a valid `type` OR root has notes[], treat as Talking v2
            const looksTalking =
            items.some((it) => isObject(it) && "type" in it) ||
            (hasKey(obj, "notes") && isStringArray(obj.notes));

            if (looksTalking) {
            const points = items
                .filter(isV2TalkingItem)
                .map((x) => ({
                text: x.text,
                type: (isObject(x) && (x["type"] as TalkingType | undefined)) ?? undefined,
                job_chunks: (isObject(x) && (x["job_chunks"] as number[] | undefined)) ?? undefined,
                }));
            const notes = hasKey(obj, "notes") && isStringArray(obj.notes) ? obj.notes : undefined;
            if (points.length > 0) return { points, notes } as TalkingJSON;
            }

            // Otherwise treat as Bullets v2
            const bullets = items.filter(isV2BulletItem).map((x) => ({
            text: x.text,
            job_chunks: x.job_chunks,
            }));
            if (bullets.length > 0) return { bullets } as BulletsJSON;
        }

        // --- Legacy passthroughs (v1 JSON shapes you already support)
        if (hasKey(obj, "bullets") && Array.isArray(obj.bullets)) {
            // Be defensive: ensure texts are strings
            const ok = (obj.bullets as unknown[]).every(
            (b) => isObject(b) && typeof b["text"] === "string"
            );
            if (ok) return obj as unknown as BulletsJSON;
        }

        if (hasKey(obj, "points") && Array.isArray(obj.points)) {
            const ok = (obj.points as unknown[]).every(
            (p) => isObject(p) && typeof p["text"] === "string"
            );
            if (ok) return obj as unknown as TalkingJSON;
        }

        if (
            hasKey(obj, "subject") &&
            typeof obj.subject === "string" &&
            hasKey(obj, "body_paragraphs") &&
            Array.isArray(obj.body_paragraphs)
        ) {
            return obj as unknown as CoverJSON;
        }

        if (
            hasKey(obj, "coverage") &&
            typeof obj.coverage === "number" &&
            hasKey(obj, "strengths") &&
            Array.isArray(obj.strengths)
        ) {
            return obj as unknown as AlignJSON;
        }

        return null;
    }


    function parseJSON(s: string | null | undefined): AnyJSON | null {
        if (!s || typeof s !== "string") return null;
        let txt = s.trim();

        // Strip triple backticks (with or without language tag)
        if (txt.startsWith("```")) {
            const parts = txt.split("```");
            if (parts.length >= 3) {
            const inner = parts[1].trim();
            const nl = inner.indexOf("\n");
            txt = (nl > -1 && /^[a-z]+$/i.test(inner.slice(0, nl).trim()))
                ? inner.slice(nl + 1).trim()
                : inner;
            }
        }

        const candidates: string[] = [];
        const firstBrace = txt.indexOf("{");
        const lastBrace  = txt.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) candidates.push(txt.slice(firstBrace, lastBrace + 1));
        candidates.push(txt);

        for (const c of candidates) {
            try {
            const parsedUnknown = JSON.parse(c) as unknown;
            const normalized = normalizeAnyJSON(parsedUnknown);
            if (normalized) return normalized;
            } catch {
            // try next candidate
            }
        }
        return null;
    }

    function premiumLabel(p: { days_left?: number; expires_at?: string } | null) {
      if (!p) return null;
      if (typeof p.days_left === 'number')
        return `${Math.max(0, p.days_left)} day${p.days_left === 1 ? '' : 's'} left`;
      if (p.expires_at)
        return `Ends ${new Date(p.expires_at).toLocaleDateString()}`;
      return null;
    }


    const outOfCredits =
      !FREE_MODE && !isUnlimited && typeof credits === 'number' && credits <= 0;

    const canSubmit =
      (!!url || jobText.trim().length > 0) &&
      !isGenerating &&
      (!outOfCredits || isUnlimited || FREE_MODE);

    return (
        <>
        <FinalizeReferral />
        <Head>
            <title>Draft — AI Resume Builder & ATS Checks | Resume Bender</title>
            <meta
            name="description"
            content="One workspace to generate ATS-friendly resume bullets, tailored cover letters, and alignment insights. Paste a job post and get results in minutes."
            />
            <link rel="canonical" href="https://resume-bender.seanhing.co/draft" />
        </Head>
        <main className="p-4 md:p-8 space-y-4">
            <TutorialModal open={showTut} onClose={() => {markTutorialSeen(); setShowTut(false);}} />
            {showReferralPrompt && (
              <div className="mx-auto w-full max-w-[680px] md:max-w-3xl px-4 mb-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">Nice work — your draft is ready 🎉</div>
                    <p className="mt-1 text-sm text-indigo-900/90">
                      Want free credits? Set up your referral link on your Account page and earn rewards when friends sign up.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReferralPrompt(false);
                      }}
                      className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
                    >
                      Maybe later
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReferralPrompt(false);
                        router.push("/account#referrals");
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Go to referrals
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="mx-auto w-full max-w-[680px] md:max-w-3xl px-4">
                <div className="mb-3 flex items-center">
                    <h1 className="text-2xl font-bold">Resume Bender</h1>

                    <div className="ml-auto flex items-center gap-2">
                        <CreditBadge value={credits} unlimited={isUnlimited} loading={isGenerating} />
                        {premium?.active && premiumLabel(premium) && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Premium · {premiumLabel(premium)}
                          </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowTut(true)}
                            title="Open tutorial"
                            aria-label="Open tutorial"
                            className="rounded-full border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            ?
                        </button>
                    </div>
                </div>
                <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-6">
                    <form className="grid grid-cols-1 gap-4 md:gap-6" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
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
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="job_text" className={labelBase}>Job description (optional)</label>
                          <textarea
                              id="job_text"
                              name="job_text"
                              rows={8}
                              placeholder="Paste the full job description here. If provided, we’ll use this instead of fetching the URL."
                              className={`${inputBase} min-h-28 md:min-h-40 leading-relaxed`}
                              value={jobText}
                              onChange={(e) => setJobText(e.target.value)}
                          />
                          <small className="text-neutral-500 mt-1 md:mt-0">
                              You can provide a URL, paste the description, or both. If pasted, we’ll ignore the URL fetch.
                          </small>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="job_title" className={labelBase}>Job title (optional)</label>
                          <input
                              id="job_title"
                              name="job_title"
                              type="text"
                              placeholder='Job title'
                              className={inputBase}
                              value={jobTitle}
                              onChange={(e) => setJobTitle(e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className={labelBase}>Tasks</label>
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-2">
                              {TASK_OPTIONS.map(opt => {
                                  const st = taskStatus[opt.key]?.phase;
                                  const details = TASK_DETAILS[opt.key]; 
                                  return (
                                      <label key={opt.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ring-1 ring-black/10 text-sm text-neutral-800">
                                          <input
                                              type="checkbox"
                                              className="h-4 w-4 rounded border-slate-300"
                                              checked={selectedTasks.includes(opt.key)}
                                              onChange={() => toggleTask(opt.key)}
                                          />
                                          <span>{opt.label}</span>

                                          {/* cost badge */}
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-neutral-700">
                                              {details.cost} credits
                                          </span>
                                          <div className="hidden md:inline-flex">
                                            <Tooltip content={
                                                <span>
                                                    {details.info}
                                                    <br />
                                                    <span className="text-neutral-500">Est. cost: {details.cost} credits</span>
                                                </span>
                                            }>
                                                <button
                                                    type="button"
                                                    aria-label={`${opt.label} info`}
                                                    className="h-5 w-5 inline-flex items-center justify-center rounded-full border text-[10px] text-neutral-700 hover:bg-neutral-100"
                                                    tabIndex={0}
                                                >
                                                i
                                                </button>
                                            </Tooltip>
                                          </div>

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
                          <small className="text-neutral-500 mt-1 md:mt-0">
                              Select one or more tasks to run.
                          </small>
                        </div>

                        
                        
                        <div className="space-y-2">
                          <label htmlFor="resume_file" className={labelBase}>Resume file (PDF/TXT)</label>
                          <input
                              id="resumeFile"
                              name="resume_file"
                              type="file"
                              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                              placeholder="Upload Resume File"
                              className="block w-full text-neutral-800 text-sm file:cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-slate-200"
                              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                          />
                        {/* {resumeFile && <small>Selected: {resumeFile.name}</small>} */}
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="resume" className={labelBase}>Resume text (optional)</label>
                          <textarea
                              id="resume"
                              name="resume"
                              placeholder="Resume"
                              rows={6}
                              className={`${inputBase} min-h-28 md:min-h-40 leading-relaxed`}
                              value={resumeText}
                              onChange={(e) => setResumeText(e.target.value)}
                          >
                          </textarea>
                          <small className="text-neutral-500 mt-1 md:mt-0">
                              You can provide a resume file, paste the text, or both. If pasted, we’ll ignore the uploaded file.
                          </small>
                        </div>

                        {/* Submit */}
                        <button 
                            type="button" 
                            onClick={onGenerateAll}
                            className="w-full md:w-auto inline-flex justify-center items-center rounded-lg bg-indigo-600 px-5 py-3 text-base md:text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!canSubmit}>
                                {isUnlimited ? (isGenerating ? "Generating…" : "Get Resume Insights")
                                    : (outOfCredits ? "Out of credits" : (isGenerating ? "Generating…" : "Get Resume Insights"))}
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
                {!FREE_MODE &&
                  !isUnlimited &&
                  typeof credits === 'number' &&
                  credits <= 0 &&
                  !upgradeMsg && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      You’re out of credits. <a className="underline" href="/account/billing">Upgrade</a> to continue.
                    </div>
                )}

                {!FREE_MODE && upgradeMsg && (
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
                            {/* {r?.raw && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-neutral-600 hover:underline">
                                Show raw model output
                                </summary>
                                <pre className="mt-2 whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-xs font-mono text-slate-800">
                                {r.raw}
                                </pre>
                            </details>
                            )} */}
                            {t === "bullets" ? (
                                (() => {
                                    const j = r?.json;
                                    const isV2 = !!j && looksBulletsV2(j);
                                    return (
                                    <div className="space-y-3">
                                        {isV2 ? (
                                        <>
                                            <BulletsView data={j} />
                                            {/* Optional: keep ATS summary visible under the cards */}
                                            {hasAtsSummary(j) && (
                                            <div className="rounded-xl border bg-white p-4 shadow-sm">
                                                <div className="flex items-start gap-4">
                                                {/* Ring (always try; render only if we have a number) */}
                                                {(() => {
                                                    const pct = getAtsCoveragePercent(j);
                                                    // optional debug:
                                                    // console.log("[draft] ATS coverage pct:", pct);
                                                    return pct !== null ? <PercentRing value={pct} label="ATS coverage" /> : null;
                                                })()}

                                                <div className="flex-1">
                                                    <h3 className="mb-1 text-sm font-semibold text-neutral-900">ATS summary</h3>
                                                    <div className="text-sm text-neutral-700 space-y-1">
                                                    {j.ats_summary.covered_keywords?.length ? (
                                                        <div>
                                                        <span className="font-medium">Covered:</span>{" "}
                                                        {j.ats_summary.covered_keywords.join(", ")}
                                                        </div>
                                                    ) : null}
                                                    {j.ats_summary.missing_keywords?.length ? (
                                                        <div>
                                                        <span className="font-medium">Missing:</span>{" "}
                                                        {j.ats_summary.missing_keywords.join(", ")}
                                                        </div>
                                                    ) : null}
                                                    </div>
                                                </div>
                                                </div>
                                            </div>
                                            )}
                                        </>
                                        ) : (
                                        <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                            {formatResult(t, r)}
                                        </pre>
                                        )}
                                    </div>
                                    );
                                })()
                                ) : t === "talking_points" ? (
                                    (() => {
                                        // Normalize whatever came back (raw JSON object or fenced JSON string you parsed)
                                        const playbook = normalizePlaybook(r?.json);
                                        return playbook ? (
                                        <TalkingPlaybookView data={playbook} />
                                        ) : (
                                        <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                            {formatResult(t, r)}
                                        </pre>
                                        );
                                })()
                                ) : t === "alignment" ? (
                                    (() => {
                                        const j = r?.json;
                                        return j && isAlign(j)
                                        ? <AlignmentView data={j} />
                                        : (
                                            <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                            {formatResult(t, r)}
                                            </pre>
                                        );
                                    })()
                                ) : t === "cover_letter" ? (
                                    (() => {
                                        const j = r?.json;
                                        return j && isCover(j) ? (
                                        <CoverLetterView data={j} />
                                        ) : (
                                        <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                            {formatResult(t, r)}
                                        </pre>
                                        );
                                    })()
                                ) : (
                                <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                                    {formatResult(t, r)}
                                </pre>
                                )}
                            </section>
                        );
                        })}
                    </div>
                )}
            </div>
        </main>
        </>
    );
}

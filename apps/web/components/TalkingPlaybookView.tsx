"use client";
import React from "react";

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

// Extract JSON from markdown code blocks
function extractJsonFromMarkdown(s: string): unknown | null {
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

export default function TalkingPlaybookView({ data }: { data: TalkingPlaybookJSON | unknown }) {
  // Normalize input if it's not the full JSON object (e.g. if it's just an array of points from V1)
  const normalized: TalkingPlaybookJSON = React.useMemo(() => {
    // 1. If it's a string, try to parse it (might be markdown-wrapped JSON)
    if (typeof data === "string") {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = extractJsonFromMarkdown(data);
      }
      
      if (parsed && typeof parsed === "object" && parsed !== null) {
        const p = parsed as Record<string, unknown>;
        // Check if it looks like interview points structure
        if ("strengths" in p || "gaps" in p || "interview_questions" in p) {
          return {
            strengths: Array.isArray(p.strengths) ? p.strengths : [],
            gaps: Array.isArray(p.gaps) ? p.gaps : [],
            interview_questions: Array.isArray(p.interview_questions) ? p.interview_questions : [],
            summary: p.summary
          } as TalkingPlaybookJSON;
        }
      }
    }
    
    // 2. If it's the full V2 object
    if (data && typeof data === 'object' && !Array.isArray(data) && 'strengths' in data) {
      return data as TalkingPlaybookJSON;
    }
    // 3. If it's an array (old V1 "Talking Points"), map to a mock structure
    if (Array.isArray(data)) {
      return {
        strengths: [],
        gaps: [],
        interview_questions: data.map((d: unknown) => {
          let text = "";
          if (typeof d === "string") text = d;
          else if (typeof d === "object" && d !== null && "text" in d) text = String((d as { text: unknown }).text);
          else text = JSON.stringify(d);

          return {
            question: text,
            expected_focus: "General",
          };
        }),
        summary: undefined
      };
    }
    // 4. Fallback
    return { strengths: [], gaps: [], interview_questions: [] };
  }, [data]);

  // Use normalized data instead of data prop
  const d = normalized;
  return (
    <div className="space-y-4">
      {/* Strengths */}
      <section className="rounded-xl border bg-background p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Strengths</h3>
        <ul className="space-y-3">
          {d.strengths?.map((s, i) => (
            <li key={i} className="rounded-lg bg-muted p-3">
              <div className="font-medium text-foreground">• {s.requirement}</div>
              {s.evidence && <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold">evidence:</span> {s.evidence}</div>}
              {s.rationale && <div className="text-xs text-muted-foreground"><span className="font-semibold">why:</span> {s.rationale}</div>}
            </li>
          ))}
        </ul>
      </section>

      {/* Gaps */}
      <section className="rounded-xl border bg-background p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Gaps & Mitigations</h3>
        <ul className="space-y-3">
          {d.gaps?.map((g, i) => (
            <li key={i} className="rounded-lg bg-muted p-3">
              <div className="font-medium text-foreground">• {g.requirement}</div>
              <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold">why:</span> {g.rationale}</div>
              <div className="text-xs text-muted-foreground"><span className="font-semibold">mitigation:</span> {g.mitigation}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Interview questions */}
      <section className="rounded-xl border bg-background p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Likely Interview Questions</h3>
        <ul className="space-y-3">
          {d.interview_questions?.map((q, i) => (
            <li key={i} className="rounded-lg bg-muted p-3">
              <div className="font-medium text-foreground">• {q.question}</div>
              {q.expected_focus && (
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold">focus:</span> {q.expected_focus}
                </div>
              )}
              {q.answer_tips?.length ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">tips:</span> {q.answer_tips.join(" • ")}
                </div>
              ) : null}
              {q.prep_example && (
                <div className="text-[11px] italic text-muted-foreground mt-0.5">
                  {q.prep_example}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Summary (optional) */}
      {d.summary && (
        <section className="rounded-xl border bg-background p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Summary</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {d.summary.overall_strengths?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">overall_strengths</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {d.summary.overall_strengths.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
            {d.summary.overall_gaps?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">overall_gaps</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {d.summary.overall_gaps.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
            {d.summary.prep_focus?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">prep_focus</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {d.summary.prep_focus.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

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

export default function TalkingPlaybookView({ data }: { data: TalkingPlaybookJSON }) {
  return (
    <div className="space-y-4">
      {/* Strengths */}
      <section className="rounded-xl border bg-background p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Strengths</h3>
        <ul className="space-y-3">
          {data.strengths?.map((s, i) => (
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
          {data.gaps?.map((g, i) => (
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
          {data.interview_questions?.map((q, i) => (
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
      {data.summary && (
        <section className="rounded-xl border bg-background p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Summary</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.summary.overall_strengths?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">overall_strengths</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {data.summary.overall_strengths.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
            {data.summary.overall_gaps?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">overall_gaps</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {data.summary.overall_gaps.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
            {data.summary.prep_focus?.length ? (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">prep_focus</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {data.summary.prep_focus.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

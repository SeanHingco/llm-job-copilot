"use client";
import PercentRing from "components/PercentRing";

type AlignJSON = {
  summary: string;
  coverage: number;
  strengths: { requirement: string; evidence_resume?: string; job_chunks?: number[] }[];
  gaps: { requirement: string; why_it_matters?: string; suggested_edit?: string }[];
  missing_keywords?: string[];
  suggested_edits?: { type: string; before?: string; after: string; note?: string }[];
  questions_for_candidate?: string[];
};

export default function AlignmentView({ data }: { data: AlignJSON }) {
  const {
    summary, coverage, strengths, gaps,
    missing_keywords, questions_for_candidate
  } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <PercentRing value={Math.max(0, Math.min(100, Math.round(coverage)))} label="Coverage" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">Summary</h3>
          <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{summary}</p>
          {missing_keywords?.length ? (
            <p className="text-sm text-neutral-700 mt-2">
              <span className="font-medium">Missing keywords:</span> {missing_keywords.join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-neutral-900 mb-2">Strengths</h4>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={`str-${i}`} className="text-sm text-neutral-800">
                <div className="font-medium">• {s.requirement}</div>
                {s.evidence_resume ? (
                  <div className="text-neutral-600 mt-0.5">evidence: {s.evidence_resume}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-neutral-900 mb-2">Gaps</h4>
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={`gap-${i}`} className="text-sm text-neutral-800">
                <div className="font-medium">• {g.requirement}</div>
                {g.why_it_matters ? (
                  <div className="text-neutral-600 mt-0.5">why it matters: {g.why_it_matters}</div>
                ) : null}
                {g.suggested_edit ? (
                  <div className="text-neutral-600 mt-0.5 whitespace-pre-wrap">suggested: {g.suggested_edit}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {questions_for_candidate?.length ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-neutral-900 mb-2">Questions for you</h4>
          <ul className="space-y-1">
            {questions_for_candidate.map((q, i) => (
              <li key={`q-${i}`} className="text-sm text-neutral-800">• {q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

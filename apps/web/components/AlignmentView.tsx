"use client";
import PercentRing from "components/PercentRing";
import { useMemo } from "react";

type AlignJSON = {
  summary: string;
  coverage: number;
  strengths: { requirement: string; evidence_resume?: string; job_chunks?: number[] }[];
  gaps: { requirement: string; why_it_matters?: string; suggested_edit?: string }[];
  missing_keywords?: string[];
  suggested_edits?: { type: string; before?: string; after: string; note?: string }[];
  questions_for_candidate?: string[];
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

export default function AlignmentView({ data }: { data: AlignJSON | string | { bullets?: string } }) {
  // Normalize the data - handle string input, object with bullets property, or direct object
  const normalized: AlignJSON | null = useMemo(() => {
    // If it's a string, try to parse it (might be markdown-wrapped JSON)
    if (typeof data === "string") {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = extractJsonFromMarkdown(data);
      }
      
      if (parsed && typeof parsed === "object" && parsed !== null) {
        const p = parsed as Record<string, unknown>;
        // Check if it looks like ATS alignment structure
        if ("summary" in p && "coverage" in p) {
          return {
            summary: p.summary || "",
            coverage: typeof p.coverage === 'number' ? p.coverage : 0,
            strengths: Array.isArray(p.strengths) ? p.strengths : [],
            gaps: Array.isArray(p.gaps) ? p.gaps : [],
            missing_keywords: Array.isArray(p.missing_keywords) ? p.missing_keywords : [],
            suggested_edits: Array.isArray(p.suggested_edits) ? p.suggested_edits : [],
            questions_for_candidate: Array.isArray(p.questions_for_candidate) ? p.questions_for_candidate : [],
          } as AlignJSON;
        }
      }
      // If parsing failed, return null to show fallback
      return null;
    }
    
    // If it's an object with a bullets property (wrapper structure)
    if (data && typeof data === 'object' && data !== null && 'bullets' in data) {
      const bulletsValue = (data as { bullets: unknown }).bullets;
      if (typeof bulletsValue === 'string') {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(bulletsValue);
        } catch {
          parsed = extractJsonFromMarkdown(bulletsValue);
        }
        
        if (parsed && typeof parsed === "object" && parsed !== null) {
          const p = parsed as Record<string, unknown>;
          if ("summary" in p && "coverage" in p) {
            return {
              summary: p.summary || "",
              coverage: typeof p.coverage === 'number' ? p.coverage : 0,
              strengths: Array.isArray(p.strengths) ? p.strengths : [],
              gaps: Array.isArray(p.gaps) ? p.gaps : [],
              missing_keywords: Array.isArray(p.missing_keywords) ? p.missing_keywords : [],
              suggested_edits: Array.isArray(p.suggested_edits) ? p.suggested_edits : [],
              questions_for_candidate: Array.isArray(p.questions_for_candidate) ? p.questions_for_candidate : [],
            } as AlignJSON;
          }
        }
      }
    }
    
    // If it's already a valid AlignJSON object
    if (data && typeof data === 'object' && data !== null && 'summary' in data && 'coverage' in data) {
      return data as AlignJSON;
    }
    
    return null;
  }, [data]);

  // If we couldn't normalize the data, show fallback
  if (!normalized) {
    if (typeof data === 'string') {
      return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-2">Alignment Report</h3>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{data}</div>
        </div>
      )
    }
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">No structured alignment data found.</p>
      </div>
    );
  }

  const {
    summary, coverage, strengths = [], gaps = [],
    missing_keywords = [], questions_for_candidate = []
  } = normalized;

  if (!summary && !coverage && !strengths) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">No structured alignment data found.</p>
      </div>
    );
  }

  // Safely handle coverage value - ensure it's a valid number
  const safeCoverage = typeof coverage === 'number' && !isNaN(coverage) 
    ? Math.max(0, Math.min(100, Math.round(coverage))) 
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <PercentRing value={safeCoverage} label="Coverage" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Summary</h3>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{summary}</p>
          {missing_keywords?.length ? (
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium"><b>Missing keywords:</b></span> {missing_keywords.join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase mb-2">Strengths</h4>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={`str-${i}`} className="text-sm text-muted-foreground">
                <div className="font-medium">• {s.requirement}</div>
                {s.evidence_resume ? (
                  <div className="text-muted-foreground mt-0.5">evidence: {s.evidence_resume}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase mb-2">Gaps</h4>
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={`gap-${i}`} className="text-sm text-muted-foreground">
                <div className="font-medium">• {g.requirement}</div>
                {g.why_it_matters ? (
                  <div className="text-muted-foreground mt-0.5">why it matters: {g.why_it_matters}</div>
                ) : null}
                {g.suggested_edit ? (
                  <div className="text-muted-foreground mt-0.5 whitespace-pre-wrap"><b>suggested: </b>{g.suggested_edit}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {questions_for_candidate?.length ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground mb-2">Questions for you</h4>
          <ul className="space-y-1">
            {questions_for_candidate.map((q, i) => (
              <li key={`q-${i}`} className="text-sm text-muted-foreground">• {q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// app/page.tsx
import CTAButtons from "components/CTAButtons";

const features = [
  { title: "Resume Bullets", copy: "Six impact-focused bullets with evidence and ATS keywords." },
  { title: "Talking Points", copy: "Strengths, gaps (with mitigation), and likely interview questions." },
  { title: "Alignment Report", copy: "Coverage %, matched/missing keywords, and suggested edits." },
  { title: "Cover Letter", copy: "A concise, tailored draft ready to paste." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Tailor your resume to every job in minutes
        </h1>
        <p className="mt-4 text-neutral-300 max-w-2xl">
          Paste a job, add your resume, pick tasks. Get bullets, talking points, alignment,
          and a cover letter—fast.
        </p>

        <div className="mt-8">
          <CTAButtons />
        </div>
      </section>

      {/* Features strip */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-300">{f.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { n: "1", t: "Drop the job", d: "Paste the URL or the full description." },
            { n: "2", t: "Add your resume", d: "Paste text or upload your file." },
            { n: "3", t: "Pick tasks", d: "Bullets, talking points, alignment, cover letter." },
            { n: "4", t: "Generate & tweak", d: "Copy into your application." },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
                {step.n}
              </div>
              <h3 className="mt-3 text-base font-semibold">{step.t}</h3>
              <p className="mt-2 text-sm text-neutral-300">{step.d}</p>
            </li>
          ))}
        </ol>

        {/* tiny trust blurb (optional) */}
        <p className="mt-8 text-xs text-neutral-400">
          We don’t sell your data. You control what’s stored and can delete it anytime.
        </p>
      </section>
    </main>
  );
}

// app/page.tsx
import CTAButtons from "components/CTAButtons";

const features = [
  { title: "Resume Bullets", copy: "Six powerful bullets tailored to the job, packed with evidence and ATS keywords." },
  { title: "Talking Points", copy: "Show up prepared: strengths, gap fixes, and likely interview questions." },
  { title: "Alignment Report", copy: "See your match score, missing keywords, and specific edits to improve fit." },
  { title: "Cover Letter", copy: "A concise draft in the job’s language, ready to paste and send." },
];

export const metadata = {
  title: 'Resume Bender — AI Resume Builder & ATS Checker',
  description:
    'Generate ATS-friendly resume bullets and tailored cover letters. Score your resume, fix issues, and apply with confidence—fast.',
  alternates: { canonical: 'https://resume-bender.seanhing.co/' },
};

export default function HomePage() {
  const faq = {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    "mainEntity":[
      {"@type":"Question","name":"Will this help me pass ATS?","acceptedAnswer":{"@type":"Answer","text":"Yes. We analyze formatting and keywords, then suggest fixes so your resume parses and matches the job posting."}},
      {"@type":"Question","name":"Is there a free plan?","acceptedAnswer":{"@type":"Answer","text":"Yes. You can try core features free and upgrade for unlimited tasks and advanced options."}},
      {"@type":"Question","name":"How fast are results?","acceptedAnswer":{"@type":"Answer","text":"Most drafts generate in under a minute—resume bullets, cover letters, and ATS insights."}}
    ]
  };

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Resume Bender",
    "url": "https://resume-bender.seanhing.co/",
    "logo": "https://resume-bender.seanhing.co/og.png"
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Resume Bender",
    "url": "https://resume-bender.seanhing.co/"
  };


  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-900/60 bg-neutral-950/70 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="font-semibold tracking-tight">Resume Bender</span>
          <div className="flex items-center gap-3">
            <a href="#how-it-works" className="text-sm text-neutral-300 hover:text-white">
              How it works
            </a>
            {/* <a href="/pricing" className="text-sm text-neutral-300 hover:text-white">
              Pricing
            </a> */}
            <a href="/login" className="text-sm text-neutral-300 hover:text-white">
              Login
            </a>
            <a
              href="/draft"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              Try it free
            </a>
            <a
              href="/features"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              Features
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          AI Resume Builder, ATS Checker, Cover Letter Assistant
        </h1>
        <p className="mt-4 text-neutral-300 max-w-2xl">
          Stop guessing what to include. Resume Bender highlights what recruiters look for.
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
            { n: "1", t: "Drop the job", d: "Paste the job URL or full text description." },
            { n: "2", t: "Add your resume", d: "Upload a file or paste the text." },
            { n: "3", t: "Choose your tasks", d: "Bullets, talking points, alignment report, cover letter." },
            { n: "4", t: "Generate & apply", d: "Review, tweak, and paste into your application." },
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

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </main>
  );
}

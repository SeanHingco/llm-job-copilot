// app/page.tsx
import CTAButtons from "components/CTAButtons";
import SidebarCTA from "components/SidebarCTA";

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
            <a
              href="/features"
              className="text-sm text-neutral-300 hover:text-white"
            >
              Features
            </a>
            {/* <a href="/pricing" className="text-sm text-neutral-300 hover:text-white">
              Pricing
            </a> */}
            <a href="/login" className="text-sm text-neutral-300 hover:text-white">
              Login
            </a>
            {/* <a
              href="/login"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              Try it free
            </a> */}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <div className="md:flex md:items-start md:justify-between md:gap-10">
          {/* Left side */}
          <div className="md:max-w-xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              Stop getting rejected with resumes that don’t match the job.
            </h1>
            <p className="mt-4 max-w-2xl text-neutral-200 text-base md:text-lg leading-relaxed">
            Resume Bender is your AI assistant that analyzes the posting, rewrites your bullets, and shows you exactly why recruiters would say yes or no.
            </p>

            <div className="mt-8">
              <CTAButtons />
            </div>
          </div>

          {/* Right side: offer box */}
          <aside className="mt-8 md:mt-0 md:w-80">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 md:p-6 text-sm">
              <h3 className="text-sm font-semibold text-neutral-50">
                Everything you get instantly
              </h3>

              <ul className="mt-4 space-y-2 text-neutral-200">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-xs">✔</span>
                  <span>60-second resume scan</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-xs">✔</span>
                  <span>Match score + missing keywords</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-xs">✔</span>
                  <span>Auto-rewritten bullet points</span>
                </li>
              </ul>

              <SidebarCTA />

              <p className="mt-3 text-s text-neutral-400 text-center md:text-left">
                Limited launch access. No credit card required.
              </p>
            </div>
          </aside>
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

      {/* Proof: before/after + output screenshot */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold">
          See the difference in a single bullet
        </h2>
        <p className="mt-2 text-neutral-300 max-w-xl">
          Resume Bender takes a vague line from your resume and turns it into a clear,
          impact-focused bullet tailored to the job description.
        </p>

        <div className="mt-10 grid gap-10 md:grid-cols-2 items-start">
          {/* Before / After card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Original vs. upgraded bullet
            </h3>

            <div className="space-y-5 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Before (from your resume)
                </p>
                <p className="mt-1 text-neutral-400">
                  Built internal tools used by the operations team to manage campaign data.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                  After (generated by Resume Bender)
                </p>
                <p className="mt-1 text-neutral-100">
                  Designed and built internal tools leveraging various APIs and JavaScript/Node.js
                  to manage campaign data, directly supporting operations team efficiency.
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs text-neutral-500">
              Based on the sample job:{" "}
            </p>
            <span className="mt-5 text-neutral-300 text-xs italic">
                Backend Software Engineer (Python / APIs / Databases)
            </span>
          </div>

          {/* Output screenshot card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <p className="text-sm text-neutral-400 mb-3">
              Real output from Resume Bender (2 of the bullets you’ll get)
            </p>
            <img
              src="/screenshots/rb-bullets.png"
              alt="Resume Bender rewritten resume bullets"
              className="rounded-xl border border-neutral-800 w-full"
            />
          </div>

          <div className="mt-8">
              <CTAButtons enable_how={false}/>
          </div>
        </div>

        <p className="mt-6 text-xs text-neutral-500 text-center md:text-left">
          Screenshots captured from the live product. Your resume data is not collected and sold.
        </p>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold">
          What job seekers are saying
        </h2>
        <p className="mt-2 text-neutral-300 max-w-xl">
          Early users are using Resume Bender to tighten their resumes and feel
          more confident hitting &ldquo;submit&rdquo; on applications.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <figure className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
            <blockquote className="text-neutral-100">
              “For the first time I actually understood what was wrong with my bullets. It didn’t just rewrite them. It taught me how to write them.”
            </blockquote>
            <figcaption className="mt-3 text-xs text-neutral-400">
              — J.K., New grad software engineer
            </figcaption>
          </figure>

          <figure className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
            <blockquote className="text-neutral-100">
              “Good research relies on a good team. Resume Bender really helped me target my CV’s to the team I align best with.”
            </blockquote>
            <figcaption className="mt-3 text-xs text-neutral-400">
              — V.V., Healthcare Professional
            </figcaption>
          </figure>

          <figure className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
            <blockquote className="text-neutral-100">
              “Transitioning out of the Army was overwhelming. Resume Bender helped me translate my military experience into civilian language and made switching career paths feel possible.”
            </blockquote>
            <figcaption className="mt-3 text-xs text-neutral-400">
              — I.S., Army Veteran seeking career change
            </figcaption>
          </figure>
        </div>

        <div className="mt-8">
          <CTAButtons enable_how={false} />
        </div>
      </section>



      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
        <p className="mt-2 text-neutral-300">
          4 easy steps to tailor your resume in minutes.
        </p>
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

        <div className="mt-8">
          <CTAButtons enable_how={false}/>
        </div>
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

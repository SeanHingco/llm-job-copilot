import Link from "next/link";

export const metadata = {
  title: "Blog — Resume Bender",
  description:
    "Deep dives, tips, and behind-the-scenes notes on beating ATS, writing better resumes, and surviving the job hunt.",
};

type BlogPost = {
  slug: string;
  title: string;
  tag: string;
  blurb: string;
  status?: "coming_soon" | "published";
};

// You can hardcode a few “upcoming” posts for now.
// Later, this can come from a CMS, MDX, or your API.
const POSTS: BlogPost[] = [
  {
    slug: "why-your-resume-never-gets-seen",
    title: "Why Your Resume Never Gets Seen (And What ATS Is Actually Doing)",
    tag: "ATS & Filtering",
    blurb:
      "A plain-English breakdown of how resume scanners work, what they look for, and why great candidates still get filtered out.",
    status: "coming_soon",
  },
  {
    slug: "turn-one-resume-into-many",
    title: "How to Turn One Resume Into 10 Tailored Versions in Under an Hour",
    tag: "Resume Strategy",
    blurb:
      "Step-by-step strategies and templates for tailoring your resume without starting from scratch every time.",
    status: "coming_soon",
  },
  {
    slug: "inside-resume-bender",
    title: "Inside Resume Bender: Why I Built It After Being Laid Off",
    tag: "Founder Notes",
    blurb:
      "A personal note from Sean about getting laid off, months of ghosting, and the experiments that turned into Resume Bender.",
    status: "coming_soon",
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Resume Bender · Blog
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Job search, resumes, and the reality of modern hiring.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-neutral-600 md:text-base">
            Essays, guides, and founder notes on beating resume scanners,
            getting to real human conversations, and staying sane while you job
            hunt.
          </p>

          {/* Coming soon pill */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-1 text-xs text-indigo-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
            First articles are on the way — in the meantime, here’s what’s coming.
          </div>
        </header>

        {/* Post list */}
        <section className="mt-8 space-y-4">
          {POSTS.map((post) => {
            const isComingSoon = post.status === "coming_soon";

            return (
              <article
                key={post.slug}
                className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md md:p-5"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
                    {post.tag}
                  </span>
                  {isComingSoon && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Coming soon
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-neutral-900 md:text-lg">
                    {post.title}
                  </h2>
                  <p className="text-sm text-neutral-600">{post.blurb}</p>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
                  {isComingSoon ? (
                    <span className="italic">
                      Drafting in progress. This article will appear here once
                      it&apos;s ready.
                    </span>
                  ) : (
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Read article
                      <span aria-hidden className="ml-1">
                        →
                      </span>
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Optional email / CTA footer */}
        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
          <h2 className="text-sm font-semibold text-neutral-900 md:text-base">
            Want to know when the first posts drop?
          </h2>
          <p className="mt-1 text-xs text-neutral-600 md:text-sm">
            I&apos;ll share new posts (and product updates) occasionally — no
            spam, just stuff that actually helps you get hired.
          </p>
          {/* You can wire this later to a real email capture */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled
            />
            <button
              type="button"
              disabled
              className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 sm:w-auto"
            >
              Coming soon
            </button>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            Email subscriptions aren&apos;t wired up yet — this is just a preview
            of where they&apos;ll live.
          </p>
        </section>
      </div>
    </main>
  );
}

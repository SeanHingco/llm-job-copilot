export const metadata = {
  title: 'Features — AI Resume Builder & ATS Checks | Resume Bender',
  description:
    'Generate ATS-friendly resume bullets, tailored cover letters, and alignment insights in one workspace.',
  alternates: { canonical: 'https://resume-bender.seanhing.co/features' },
};

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-3xl py-10 space-y-6">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Features</h1>

      <section>
        <h2 className="text-xl font-semibold">AI resume bullet generator</h2>
        <p>Turn tasks into quantified, recruiter-ready bullets with action verbs and impact.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">ATS checks & alignment</h2>
        <p>Paste a job post to see missing keywords, formatting issues, and alignment tips.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Cover letters</h2>
        <p>Generate tailored drafts from your resume and the job description in minutes.</p>
      </section>

      <p><a className="underline" href="/login">Start the AI resume builder</a></p>
    </main>
  );
}

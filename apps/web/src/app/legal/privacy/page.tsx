export default function PrivacyPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "seanescan@gmail.com";

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>

      <section>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <p>When you use Resume Bender, we collect:</p>
        <ul className="list-disc pl-5">
          <li>Account information: your email address (used for login and communication).</li>
          <li>Usage data: events like when you generate drafts, spend credits, or run tasks.</li>
          <li>Billing data: payment information and metadata handled securely by Stripe.</li>
        </ul>
        <p className="mt-4">We do not collect your personal documents or job applications unless you explicitly choose to save them to the Service.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">How we use data</h2>
        <p>We use your information only to:</p>
        <ul className="list-disc pl-5">
          <li>Operate and improve the Service.</li>
          <li>Enforce credit limits and fair use.</li>
          <li>Provide customer support.</li>
          <li>Ensure billing and account management work properly.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Third parties</h2>
        <p>We rely on reputable providers to operate parts of the Service:</p>
        <ul className="list-disc pl-5">
          <li>Supabase – authentication and database.</li>
          <li>Stripe – secure billing and payments.</li>
          <li>AI model providers (e.g. Google Gemini) – generating outputs.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Data retention & deletion</h2>
        <ul className="list-disc pl-5">
          <li>We keep your account data as long as your account is active.</li>
          <li>Generated content may be stored temporarily for reliability but is automatically deleted within a short period.</li>
          <li>You can request account deletion at any time by contacting us (see below). Upon deletion, we remove your personal data except where retention is required by law (e.g. billing records).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>Questions or requests? Reach us at <a className="underline" href={`mailto:${email}`}>{email}</a>. We’ll do our best to respond promptly.</p>
      </section>
    </main>
  );
}

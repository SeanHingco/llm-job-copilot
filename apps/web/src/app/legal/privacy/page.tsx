export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>

      <section>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <p>Account email, usage events (e.g., generating drafts), and billing metadata via Stripe.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">How we use data</h2>
        <p>Operate the service, enforce fair use/credits, improve reliability, and provide support.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Third parties</h2>
        <p>Auth & database (Supabase), payments (Stripe), and model provider (e.g., Google Gemini).</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Data retention & deletion</h2>
        <p>Briefly state how long you retain generated content and how users can request deletion.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>Questions? <a className="underline" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'}`}>Email support</a>.</p>
      </section>
    </main>
  );
}

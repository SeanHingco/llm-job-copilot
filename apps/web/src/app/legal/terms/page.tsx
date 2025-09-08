export default function TermsPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "seanescan@gmail.com";
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <p className="text-sm text-neutral-500">Last updated: {new Date().toLocaleDateString()}</p>

      <section>
        <h2 className="font-semibold">1) Service & Eligibility</h2>
        <p>Short description of what the app does and who can use it.</p>
      </section>

      <section>
        <h2 className="font-semibold">2) Credits & Usage</h2>
        <ul className="list-disc pl-5">
          <li>1 credit = 1 task. Packs don’t expire (your policy), subs refresh monthly.</li>
          <li>Free daily credits and how they reset.</li>
          <li>Fair use / rate limits.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">3) Billing & Refunds</h2>
        <ul className="list-disc pl-5">
          <li>Subscriptions auto-renew via Stripe; cancellations apply end of period.</li>
          <li>Credit packs are one-time purchases (non-refundable unless required by law).</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">4) AI Output Disclaimer</h2>
        <p>No guarantees; users must review outputs; no professional advice.</p>
      </section>

      <section>
        <h2 className="font-semibold">5) Acceptable Use</h2>
        <p>No illegal content, spam, scraping abuse, or reverse engineering.</p>
      </section>

      <section>
        <h2 className="font-semibold">6) Changes & Contact</h2>
        <p>We may update terms. Questions? {email}</p>
      </section>
    </main>
  );
}

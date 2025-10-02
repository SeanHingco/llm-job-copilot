export default function TermsPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "seanescan@gmail.com";
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <p className="text-sm text-neutral-500">Last updated: {new Date().toLocaleDateString()}</p>

      <section>
        <h2 className="font-semibold">1) Service & Eligibility</h2>
        <p>Resume Bender is an AI-powered job application assistant that helps you draft resume bullets, interview talking points, and cover letters.</p>
        <p className="mt-4">The Service is designed for job seekers and professionals. By using it, you confirm that:</p>
        <ul className="list-disc pl-5">
          <li>You are old enough to enter into a binding agreement in your country (in most places this means 18 or older).</li>
          <li>If you are younger, you may only use the Resume Bender Service with a parent or guardian’s permission.</li>
          <li>You are responsible for making sure use of the Service complies with local laws where you live.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">2) Credits & Usage</h2>
        <p>Our Service runs on a credit system so you’re always in control of what you spend.</p>
        <ul className="list-disc pl-5">
          <li>One credit = one task (such as a resume bullet draft, interview talking points, or an alignment check).</li>
          <li>For users without subscriptions, free daily credits are added to your account each day and reset at midnight. They roll over up to 20 total credits if unused.</li>
          <li>Credits are for your personal use only. Automated, bulk, or abusive use of the Service is not allowed.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">3) Billing & Refunds</h2>
        <ul className="list-disc pl-5">
          <li>Subscriptions allow for unlimited task runs, with fair use rate limits applied.</li>
          <li>You can cancel anytime. Your access continues until the end of your current billing period.</li>
          <li>Credit packs are one-time purchases and never expire.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">4) AI Output Disclaimer</h2>
        <p>The Service uses AI to generate suggestions and content. Please note:</p>
        <ul className="list-disc pl-5">
          <li>Outputs may contain mistakes, omissions, or inaccuracies.</li>
          <li>They are not professional, legal, medical, or financial advice.</li>
          <li>You are responsible for reviewing and deciding how to use any outputs.</li>
          <li>We make no guarantees about accuracy, reliability, or results (including job outcomes).</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">5) Acceptable Use</h2>
        <p>You agree not to use the Service in ways that are harmful, abusive, or unlawful. Specifically, you may not:</p>
        <ul className="list-disc pl-5">
          <li>Use the Service to break the law or violate others’ rights.</li>
          <li>Post, generate, or share illegal, hateful, or discriminatory content.</li>
          <li>Spam, harass, or misuse the Service in a way that disrupts others.</li>
          <li>Scrape, copy, or attempt to reverse engineer the Service or its outputs.</li>
          <li>Try to bypass credit limits, rate limits, or security features.</li>
          <li>Resell or redistribute the Service or its outputs without permission.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">6) Changes & Contact</h2>
        <p>We may update these Terms from time to time. If we make material changes, we’ll post the updated version here with a new “Effective” date. Continued use of the Service means you accept the updated Terms.</p>
        <p className="mt-4">If you have questions, contact us at <a href="mailto:seanescan@gmail.com" className="hover:underline">{email}</a></p>
      </section>
    </main>
  );
}

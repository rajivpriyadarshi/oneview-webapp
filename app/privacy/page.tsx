import "./privacy.css";

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: May 23, 2026</p>

        <section className="privacy-section">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly, including your name, email address,
            and financial account statements you upload. We also collect usage data such as
            pages visited, features used, and device information.
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process and analyze your uploaded financial statements</li>
            <li>Create and maintain your portfolio overview</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your requests and inquiries</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>3. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your personal and
            financial information. All data is encrypted in transit and at rest. We do not
            share or sell your data to third parties.
          </p>
        </section>

        <section className="privacy-section">
          <h2>4. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as
            needed to provide you services. You may request deletion of your data at any time
            by contacting us.
          </p>
        </section>

        <section className="privacy-section">
          <h2>5. Cookies</h2>
          <p>
            We use essential cookies to maintain your session and authentication state. We do
            not use third-party tracking cookies or advertising cookies.
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access and download your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your account and data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>7. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, please
            contact us at <a href="mailto:privacy@zinc.money">privacy@zinc.money</a>.
          </p>
        </section>
      </div>
    </main>
  );
}

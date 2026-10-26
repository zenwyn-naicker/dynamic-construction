import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "who-we-are", label: "Who we are" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "why-we-collect", label: "Why we collect it" },
  { id: "legal-basis", label: "Our legal basis" },
  { id: "storage-security", label: "Storage & security" },
  { id: "sharing", label: "Who we share it with" },
  { id: "retention", label: "How long we keep it" },
  { id: "your-rights", label: "Your rights" },
  { id: "cookies", label: "Cookies & monitoring" },
  { id: "officer", label: "Information Officer" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact & complaints" },
];

export default function Privacy() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [contentsOpen, setContentsOpen] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const updateActiveSection = () => {
      frame = null;
      const headerHeight =
        document.querySelector(".site-header")?.getBoundingClientRect().height ??
        112;
      const readingLine = headerHeight + 40;
      let current = SECTIONS[0].id;

      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= readingLine) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };

    const scheduleUpdate = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(updateActiveSection);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="privacy-page">
      <div className="privacy-hero">
        <div className="privacy-eyebrow-row">
          <span className="privacy-pill">Legal</span>
          <span className="privacy-pill privacy-pill-accent">
            POPIA-aligned
          </span>
        </div>
        <h1>Privacy policy</h1>
        <p className="privacy-lede">
          How Dynamic Construction collects, uses, and protects the personal
          information you share with us in plain language, in line with
          the Protection of Personal Information Act (POPIA).
        </p>
        <div className="privacy-meta">
          <div>
            <strong>Effective from</strong>25 September 2026
          </div>
          <div>
            <strong>Last reviewed</strong>18 October 2026
          </div>
          <div>
            <strong>Applies to</strong>this website and the client portal
          </div>
        </div>
        <div className="privacy-quick-links" aria-label="Common privacy topics">
          <a href="#what-we-collect">What we collect</a>
          <a href="#your-rights">Your rights</a>
          <a href="#officer">Contact our Information Officer</a>
        </div>
      </div>

      <div className="privacy-layout">
        <nav className="privacy-toc" aria-label="Privacy policy sections">
          <p className="privacy-toc-title">On this page</p>
          <button
            type="button"
            className="privacy-toc-toggle"
            aria-expanded={contentsOpen}
            aria-controls="privacy-contents"
            onClick={() => setContentsOpen((open) => !open)}
          >
            <span>On this page</span>
            <span aria-hidden="true">{contentsOpen ? "−" : "+"}</span>
          </button>
          <ol
            id="privacy-contents"
            className={contentsOpen ? "is-open" : undefined}
          >
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={
                    activeSection === section.id ? "location" : undefined
                  }
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article>
          <section id="who-we-are">
            <h2>
              <span className="privacy-num">01</span>Who we are
            </h2>
            <p>
              <strong>Dynamic Construction</strong> is a trading name of{" "}
              <strong>Synergy Investments 792 (Pty) Ltd</strong>, a company
              registered in South Africa and a registered home builder with
              the National Home Builders Registration Council (NHBRC),
              registration number <strong>4000008693</strong>.
            </p>
            <p className="privacy-muted">
              Wherever this policy says "Dynamic Construction," "we," "us,"
              or "our," it means Synergy Investments 792 (Pty) Ltd trading
              as Dynamic Construction. We are the responsible party for the
              personal information described in this policy, as that term
              is defined in POPIA.
            </p>
          </section>

          <section id="what-we-collect">
            <h2>
              <span className="privacy-num">02</span>What we collect
            </h2>
            <p>
              We only collect information you give us directly, through the
              estimate tool, the client portal, or by contacting us. We
              don't buy, scrape, or acquire your details from anyone else.
            </p>
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Where</th>
                  <th>What we collect</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Getting an estimate</td>
                  <td>
                    Project type, dimensions, and finish level. No personal
                    details are required until you choose to submit a quote
                    request.
                  </td>
                </tr>
                <tr>
                  <td>Quote requests &amp; sign-up</td>
                  <td>
                    Name, email address, phone number, and property/site
                    address.
                  </td>
                </tr>
                <tr>
                  <td>Client portal</td>
                  <td>
                    Project records, messages between you and our team, and
                    any documents you upload, including proof-of-payment
                    documents, which may contain your banking details.
                  </td>
                </tr>
                <tr>
                  <td>Account &amp; sign-in</td>
                  <td>
                    Your password (stored as an irreversible hash, never in
                    plain text) and a multi-factor authentication key.
                  </td>
                </tr>
                <tr>
                  <td>Getting in touch</td>
                  <td>
                    Whatever you include in a message to us, for example, a
                    phone call request or a project enquiry.
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="privacy-flag">
              <b>Banking details</b>
              If you upload a proof of payment to your project's document
              section, that document may show your bank name, account
              holder, and partial account number. We treat these documents
              the same as any other financial record. See{" "}
              <a className="privacy-inline-link" href="#storage-security">
                Storage &amp; security
              </a>
              .
            </div>
          </section>

          <section id="why-we-collect">
            <h2>
              <span className="privacy-num">03</span>Why we collect it
            </h2>
            <ul>
              <li>
                To calculate and provide indicative estimates and formal
                quotations.
              </li>
              <li>
                To manage your construction project, including scheduling,
                updates, and change requests.
              </li>
              <li>To verify payments against your project account.</li>
              <li>
                To communicate with you about your project, account, or a
                query you've raised.
              </li>
              <li>
                To keep your account secure through sign-in verification, MFA, and
                fraud prevention.
              </li>
              <li>
                To meet our own legal, tax, and NHBRC record-keeping
                obligations.
              </li>
            </ul>
            <p className="privacy-muted">
              We don't use your information for marketing you haven't asked
              for, and we don't sell it. If that ever changes for a specific
              purpose, we'll ask for your separate, explicit consent first.
            </p>
          </section>

          <section id="legal-basis">
            <h2>
              <span className="privacy-num">04</span>Our legal basis for
              processing
            </h2>
            <p>
              POPIA requires us to have a lawful reason for every piece of
              personal information we process. Here's ours:
            </p>
            <ul>
              <li>
                <strong>Performance of a contract:</strong> most of what we
                collect is necessary to quote, agree, and deliver your
                construction project.
              </li>
              <li>
                <strong>Consent:</strong> where we ask for something beyond
                what's needed for your project, we'll ask you directly
                first.
              </li>
              <li>
                <strong>Legal obligation:</strong> some records (invoices,
                payment proofs, NHBRC-related documentation) must be kept to
                comply with South African law.
              </li>
              <li>
                <strong>Legitimate interest:</strong> securing our systems
                and preventing fraud, balanced against your right to
                privacy.
              </li>
            </ul>
          </section>

          <section id="storage-security">
            <h2>
              <span className="privacy-num">05</span>Storage &amp; security
            </h2>
            <p>
              Your information is stored on Microsoft Azure infrastructure,
              hosted in South Africa where the service is available in our
              region, with encryption in transit (HTTPS) and at rest.
            </p>
            <h3>Documents you upload</h3>
            <p>
              Files, including proof-of-payment documents, are stored in a
              private storage area that only your project team and system
              administrators can access. They are never made publicly
              accessible, and are not scanned, indexed, or used for anything
              beyond your project.
            </p>
            <h3>Passwords</h3>
            <p>
              We never store your password in a form anyone, including our
              own staff, can read. Multi-factor authentication (MFA) is
              required for staff and administrator access to the hosted
              workspace and is optional for client accounts. When MFA is
              enabled, signing in requires an authenticator code unless you
              have chosen to remember that account on the same browser for
              7 days. Your password is still required when signing in.
            </p>
            <h3>Access controls</h3>
            <p>
              Staff-level features of the client portal, including anything
              that touches client financial records, require multi-factor
              authentication and are logged.
            </p>
          </section>

          <section id="sharing">
            <h2>
              <span className="privacy-num">06</span>Who we share it with
            </h2>
            <p>
              We don't sell your information, and we only share it where
              it's genuinely necessary:
            </p>
            <ul>
              <li>
                <strong>Microsoft Azure:</strong> our infrastructure
                provider, hosting the servers, database, and file storage
                your information lives on. Microsoft does not use your data
                for its own purposes.
              </li>
              <li>
                <strong>NHBRC and regulators:</strong> where we're legally
                required to demonstrate compliance as a registered home
                builder.
              </li>
              <li>
                <strong>Professional advisors:</strong> our accountant or
                legal advisor, only where necessary and under
                confidentiality.
              </li>
              <li>
                <strong>Law enforcement:</strong> only if legally compelled
                to, such as under a valid court order.
              </li>
            </ul>
            <p className="privacy-muted">
              We do not share your information with marketing companies,
              data brokers, or any third party for their own use.
            </p>
          </section>

          <section id="retention">
            <h2>
              <span className="privacy-num">07</span>How long we keep it
            </h2>
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Information</th>
                  <th>Kept for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Active project records</td>
                  <td>
                    Duration of the project, plus the statutory NHBRC and
                    warranty period that follows
                  </td>
                </tr>
                <tr>
                  <td>Financial &amp; payment records</td>
                  <td>
                    5 years, in line with South African tax and financial
                    record-keeping requirements
                  </td>
                </tr>
                <tr>
                  <td>
                    Account details, if you never proceed with a project
                  </td>
                  <td>
                    12 months of inactivity, then deleted unless you ask us
                    to keep in touch
                  </td>
                </tr>
                <tr>
                  <td>Website enquiries that don't become a project</td>
                  <td>12 months</td>
                </tr>
              </tbody>
            </table>
            <p className="privacy-muted">
              These are the legal minimums that apply to each record type.
              You can ask us to delete your information earlier. See{" "}
              <a className="privacy-inline-link" href="#your-rights">
                Your rights
              </a>
              . Some records we're legally required to keep regardless of
              your request, and we'll explain which ones if this applies.
            </p>
          </section>

          <section id="your-rights">
            <h2>
              <span className="privacy-num">08</span>Your rights
            </h2>
            <p>Under POPIA, you have the right to:</p>
            <div className="privacy-card privacy-rights-grid">
              <div className="privacy-right">
                <b>Access</b>
                <span>Ask what personal information we hold about you.</span>
              </div>
              <div className="privacy-right">
                <b>Correction</b>
                <span>
                  Ask us to fix information that's incorrect or out of date.
                </span>
              </div>
              <div className="privacy-right">
                <b>Deletion</b>
                <span>
                  Ask us to delete information we no longer need to keep.
                </span>
              </div>
              <div className="privacy-right">
                <b>Object</b>
                <span>Object to how we're processing your information.</span>
              </div>
              <div className="privacy-right">
                <b>Withdraw consent</b>
                <span>Withdraw any consent you've given us, at any time.</span>
              </div>
              <div className="privacy-right">
                <b>Complain</b>
                <span>Lodge a complaint with the Information Regulator.</span>
              </div>
            </div>
            <p>
              To exercise any of these, contact us using the details in{" "}
              <a className="privacy-inline-link" href="#contact">
                Contact &amp; complaints
              </a>
              . We'll respond within the time POPIA requires.
            </p>
          </section>

          <section id="cookies">
            <h2>
              <span className="privacy-num">09</span>Cookies &amp; monitoring
            </h2>
            <p>
              We use cookies for sign-in and security, and keep monitoring
              minimal.
            </p>
            <ul>
              <li>
                <strong>Session and security cookies:</strong> we use cookies
                to maintain your signed-in session and protect requests
                against forgery. Signing out ends your login session.
              </li>
              <li>
                <strong>Remember this device:</strong> if you select this
                option after entering a valid authenticator code, an
                encrypted cookie remembers verification for that account
                in that browser for 7 days. Signing out preserves this
                choice without extending the expiry. Your password is still
                required when signing in. The cookie contains no password or
                authenticator secret. You can remove it using “Forget this
                device” in your account settings. Account recovery also
                invalidates remembered verification.
              </li>
              <li>
                <strong>Application monitoring:</strong> we use Microsoft
                Azure's Application Insights, on our servers only, to
                monitor site performance and catch errors (things like
                response times and error logs). This is server-side
                telemetry: it does not run tracking scripts in your browser
                and does not monitor your individual browsing behaviour
                beyond the requests your browser makes to our own servers.
              </li>
            </ul>
            <p className="privacy-muted">
              We don't use Google Analytics, advertising pixels, or any
              third-party marketing trackers.
            </p>
          </section>

          <section id="officer">
            <h2>
              <span className="privacy-num">10</span>Information Officer
            </h2>
            <p>
              Our Information Officer is responsible for our compliance with
              POPIA and is your point of contact for any privacy-related
              question or concern.
            </p>
            <div className="privacy-officer-card">
              <div className="privacy-officer-details">
                <b>Krishna Chetty</b>
                <span>
                  Information Officer · Director, Synergy Investments 792
                  (Pty) Ltd
                </span>
                <span>krishna.dynacontr@outlook.com</span>
              </div>
            </div>
          </section>

          <section id="changes">
            <h2>
              <span className="privacy-num">11</span>Changes to this policy
            </h2>
            <p>
              We may update this policy from time to time, for example, if
              we start collecting new information or change how we use it.
              We'll update the "Last reviewed" date at the top of this
              page, and where a change is significant, we'll let existing
              clients know directly.
            </p>
          </section>

          <section id="contact">
            <h2>
              <span className="privacy-num">12</span>Contact &amp; complaints
            </h2>
            <p>
              For any question about this policy or your personal
              information, contact our Information Officer using the
              details above.
            </p>
            <p>
              If you're not satisfied with our response, you have the right
              to complain to South Africa's Information Regulator:
            </p>
            <div className="privacy-card">
              <p className="privacy-card-line">
                <strong>The Information Regulator (South Africa)</strong>
              </p>
              <p className="privacy-card-line privacy-muted">
                JD House, 27 Stiemens Street, Braamfontein, Johannesburg,
                2001
              </p>
              <p className="privacy-card-line privacy-muted">
                enquiries@inforegulator.org.za
              </p>
            </div>
          </section>

          <Link className="outline-button" to="/">
            Back to home
          </Link>
        </article>
      </div>
    </div>
  );
}

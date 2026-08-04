import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

/**
 * Public Privacy Policy page for the current Valtoris site data flow.
 *
 * INTERNAL DEVELOPER NOTE (not attorney-approved):
 * This page describes current application behavior for Sprint 4A.3 release readiness.
 * Legal review is required before treating this text as production-ready privacy counsel.
 * Do not claim CCPA, CPRA, GDPR, TCPA, HIPAA, GLBA, or other formal compliance here.
 */
export default function PrivacyPolicyPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Privacy Policy | Valtoris Financial'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <article className="privacy-page container">
      <header className="privacy-page-header">
        <p className="privacy-eyebrow">Valtoris Financial</p>
        <h1>Privacy Policy</h1>
        <p className="privacy-effective-date">
          <strong>Effective date:</strong> Pending legal review
        </p>
        <p className="privacy-intro">
          This page explains how Valtoris Financial (“Valtoris,” “we,” “us”) handles information
          submitted through this website, including the Family Financial Report Card™ Initial
          Financial Diagnostic. This description reflects the current application design and is not
          attorney-approved legal advice.
        </p>
      </header>

      <section aria-labelledby="privacy-info-collected">
        <h2 id="privacy-info-collected">Information collected</h2>
        <p>
          Depending on how you use the site, we may collect information you choose to submit,
          technical details needed to operate the service, and consent choices you make on our
          forms.
        </p>
      </section>

      <section aria-labelledby="privacy-family-report-card">
        <h2 id="privacy-family-report-card">Family Financial Report Card submissions</h2>
        <p>
          When you complete the Family Financial Report Card™ assessment, your submission is sent
          to our server endpoint and stored in our customer relationship management (CRM) system as
          an Initial Financial Diagnostic. The public results page is shown only after the CRM
          save succeeds.
        </p>
      </section>

      <section aria-labelledby="privacy-self-reported">
        <h2 id="privacy-self-reported">Self-reported financial information</h2>
        <p>
          The diagnostic uses information you enter about your household, finances, protection
          coverage, and goals. These answers are self-reported educational inputs. They are not
          independently verified at submission time and are not treated as advisor-reviewed
          Household Financial Progress evidence.
        </p>
      </section>

      <section aria-labelledby="privacy-contact-info">
        <h2 id="privacy-contact-info">Contact information</h2>
        <p>
          Family Report Card submissions may include name, email address, phone number, age, state,
          and related household details you provide. We use this information to store your
          diagnostic, identify possible existing households for internal review, and—only when
          permitted—support follow-up.
        </p>
      </section>

      <section aria-labelledby="privacy-consent-choices">
        <h2 id="privacy-consent-choices">Consent choices</h2>
        <p>
          On the Family assessment, you are asked for explicit acknowledgments and optional
          permissions. Required acknowledgments are unchecked by default. Optional marketing boxes
          are never preselected. Consent is not inferred from the mere presence of an email or
          phone number.
        </p>
      </section>

      <section aria-labelledby="privacy-relationship-photo">
        <h2 id="privacy-relationship-photo">Optional Relationship Photo (Let’s Connect)</h2>
        <p>
          After a successful Let’s Connect submission on a published advisor card, you may
          optionally add a Relationship Photo (for example a selfie taken together or an uploaded
          photo). The photo is entirely optional. Skipping it does not affect the saved connection.
        </p>
        <p>
          If you choose to add a photo and acknowledge storage, the image is stored in our private
          CRM so your advisor can remember where you met. It is a memory aid only. It is not used
          for facial recognition, biometric identification, identity verification, embeddings, or
          face matching. It is not shown on the public advisor card or client portal by default.
        </p>
        <p>
          Authorized advisors and owners may view, replace, or remove the photo inside the CRM.
          You may request removal subject to the firm’s retention practices. This description
          remains pending legal review and is not a formal compliance claim.
        </p>
      </section>

      <section aria-labelledby="privacy-crm-storage">
        <h2 id="privacy-crm-storage">CRM storage and internal review</h2>
        <p>
          Successful Family submissions create or update CRM records such as a lead, household
          linkage, and assessment history. Authorized Valtoris users may review submissions in the
          Intake workspace, household diagnostic views, and internal task queues. Internal review
          tasks do not by themselves send email, SMS, or phone outreach.
        </p>
      </section>

      <section aria-labelledby="privacy-service-providers">
        <h2 id="privacy-service-providers">Service providers</h2>
        <p>
          We use service providers to host and operate the site and CRM, including infrastructure
          and database services. Providers process information on our behalf according to our
          configuration and their terms. We do not claim that information is never shared with
          service providers needed to run the product.
        </p>
      </section>

      <section aria-labelledby="privacy-sheets">
        <h2 id="privacy-sheets">Google Sheets secondary processing</h2>
        <p>
          For Family Report Card submissions, Google Sheets may receive a secondary copy of
          submission data when a server-side Sheets webhook is configured. Sheets sync is
          best-effort and secondary to CRM storage. A Sheets failure does not remove a successful
          CRM diagnostic. Other calculators on this site may still use separate Sheets-oriented
          submission paths where those flows remain wired to browser Sheets helpers.
        </p>
      </section>

      <section aria-labelledby="privacy-how-used">
        <h2 id="privacy-how-used">How information is used</h2>
        <ul>
          <li>Calculate and store your Initial Financial Diagnostic</li>
          <li>Show your results page after a successful CRM save</li>
          <li>Support internal matching, duplicate review, and operational follow-up tasks</li>
          <li>Maintain CRM history for authorized advisors and owners</li>
          <li>Attempt secondary Sheets logging when configured</li>
          <li>Contact or market to you only according to the permissions below</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-contact-permission">
        <h2 id="privacy-contact-permission">Contact permission</h2>
        <p>
          Contact permission is a separate optional choice. If you grant it, Valtoris may contact
          you about your results and possible next steps. If you do not grant it, internal staff
          should treat the submission as review-only and should not initiate outreach based solely
          on that submission. Contact permission is not the same as email or SMS marketing consent.
        </p>
      </section>

      <section aria-labelledby="privacy-email-marketing">
        <h2 id="privacy-email-marketing">Email marketing consent</h2>
        <p>
          Email marketing consent is optional and separate from general contact permission. When
          granted, it allows occasional marketing emails. It does not authorize every form of
          contact by itself, and you may unsubscribe using the method described in those messages.
        </p>
      </section>

      <section aria-labelledby="privacy-sms-marketing">
        <h2 id="privacy-sms-marketing">SMS marketing consent</h2>
        <p>
          SMS marketing consent is optional and separate from general contact permission and email
          marketing consent. The Family assessment disables SMS marketing consent unless a phone
          number is provided, and clearing the phone number clears SMS marketing consent. Message
          and data rates may apply where SMS is used. Reply STOP to opt out of marketing texts when
          that channel is used.
        </p>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">Data retention</h2>
        <p>
          We retain CRM leads, assessments, related activity, and operational task records as needed
          for business operations, internal review, and service continuity. Retention periods may
          change as our systems and policies evolve. A formal retention schedule is subject to
          legal and operational review.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security">Security</h2>
        <p>
          We use access controls, authenticated CRM roles, and server-only secrets for privileged
          operations. No method of transmission or storage is perfectly secure. We do not claim
          that unauthorized access, disclosure, or misuse is impossible.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">User choices and requests</h2>
        <p>
          You may choose which optional permissions to grant on our forms. To ask questions about
          your information or request assistance with access, correction, or deletion where
          applicable, contact us using the email below. We may need to verify your request before
          acting on it.
        </p>
      </section>

      <section aria-labelledby="privacy-children">
        <h2 id="privacy-children">Children’s privacy</h2>
        <p>
          This website and the Family Financial Report Card™ are intended for adults making
          household planning decisions. They are not directed to children under 13, and we do not
          knowingly collect personal information from children under 13 through these forms.
        </p>
      </section>

      <section aria-labelledby="privacy-changes">
        <h2 id="privacy-changes">Policy changes</h2>
        <p>
          We may update this Privacy Policy as the product, providers, or legal requirements change.
          The effective date above will be updated when a reviewed version is published. Continued
          use of the site after an update means you should review the revised policy.
        </p>
      </section>

      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">Contact information</h2>
        <p>
          Privacy questions and requests:{' '}
          <a href="mailto:hello@valtorisfinancial.com">hello@valtorisfinancial.com</a>
        </p>
        <p>
          You can also explore scheduling options on our{' '}
          <Link to={ROUTES.schedule}>schedule page</Link>.
        </p>
      </section>

      <p className="privacy-legal-note">
        This page is provided for transparency about current site behavior. It has not been marked
        as attorney-approved and does not assert formal compliance with any specific privacy or
        communications statute.
      </p>
    </article>
  )
}

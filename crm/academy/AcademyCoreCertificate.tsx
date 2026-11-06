export type CoreCertificate = {
  id: string
  issuedAt: string
  name: string
}

export function formatCertificateDate(issuedAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'America/Chicago',
  }).format(new Date(issuedAt))
}

export default function AcademyCoreCertificate({ certificate }: { certificate: CoreCertificate }) {
  return <section className="tac-core-certificate" aria-labelledby="core-certificate-title">
    <p className="crm-page-eyebrow">Valtoris Academy</p>
    <h2 id="core-certificate-title">Valtoris Core Certificate of Completion</h2>
    <p>Awarded to</p>
    <p className="tac-core-certificate-name">{certificate.name}</p>
    <p>For completing Valtoris Core training and passing the graded exam.</p>
    <p>Issued {formatCertificateDate(certificate.issuedAt)}</p>
    <p className="tac-core-certificate-id">Certificate ID {certificate.id}</p>
    <p>Internal Valtoris training record</p>
    <button type="button" className="crm-secondary-btn tac-core-certificate-print" onClick={() => window.print()}>
      Print certificate
    </button>
  </section>
}

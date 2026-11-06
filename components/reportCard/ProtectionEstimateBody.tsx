import type { protectionEstimate } from '../../modules/reportCard/combined/protectionCalculator';

export default function ProtectionEstimateBody({ result, locale = 'en' }: {
  result: ReturnType<typeof protectionEstimate>;
  locale?: 'en' | 'es';
}) {
  const t = (en: string, es: string) => locale === 'es' ? es : en;
  const currency = new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });

  return (
    <div className="report-answer-breakdown">
      <p><strong>{result.label}</strong></p>
      {result.amount === null ? (
        <>
          <p>{t('Confirm these answers to complete your estimate.', 'Confirma estas respuestas para completar tu estimación.')}</p>
          <ul>{result.missing.map(label => <li key={label}>{label}</li>)}</ul>
        </>
      ) : (
        <>
          <p><strong>{currency.format(result.amount)}</strong></p>
          <dl>{result.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{currency.format(row.amount)}</dd></div>)}</dl>
        </>
      )}
      <p>{result.note}</p>
    </div>
  );
}

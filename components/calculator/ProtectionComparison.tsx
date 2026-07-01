const WITHOUT_ITEMS = [
  'Income Protection',
  'Housing Protection',
  'Debt Paid Off',
  "Children's Education",
]

const WITH_ITEMS = [
  'Income Protection',
  'Housing Protected',
  'Debt Eliminated',
  'College Funded',
]

export default function ProtectionComparison() {
  return (
    <section className="protection-comparison">
      <div className="protection-comparison-grid">
        <article className="protection-comparison-panel protection-comparison-negative">
          <h3>Without Adequate Life Insurance</h3>
          <ul>
            {WITHOUT_ITEMS.map((item) => (
              <li key={item}>
                <span className="comparison-icon comparison-icon-no" aria-hidden="true">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="protection-comparison-panel protection-comparison-positive">
          <h3>With Recommended Protection</h3>
          <ul>
            {WITH_ITEMS.map((item) => (
              <li key={item}>
                <span className="comparison-icon comparison-icon-yes" aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

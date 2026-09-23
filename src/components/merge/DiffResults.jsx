const SECTIONS = [
  { key: 'identifiers', title: 'Identifiers' },
  { key: 'connections', title: 'Connections' },
  { key: 'locations', title: 'Locations' },
  { key: 'pinLinks', title: 'Pin links' },
  { key: 'evidence', title: 'Evidence' },
];

const evidenceText = (e) => `${e.date} ${e.title} (${e.source})`;

function SectionDetails({ sectionKey, title, diff }) {
  const counts = diff.summary[sectionKey];
  if (counts.added + counts.removed + counts.changed === 0) return null;
  const data = diff[sectionKey];
  const render = sectionKey === 'evidence' ? evidenceText : (x) => x;
  return (
    <section className="compare-section" data-testid={`compare-${sectionKey}`}>
      <h3>
        {title}
        <span className="compare-counts">
          {counts.added > 0 && <span className="added">+{counts.added}</span>}
          {counts.removed > 0 && <span className="removed">&minus;{counts.removed}</span>}
          {counts.changed > 0 && <span className="changed">~{counts.changed}</span>}
        </span>
      </h3>
      <ul>
        {(data.added ?? []).map((item, i) => (
          <li key={`a${i}`} className="added">{render(item)}</li>
        ))}
        {(data.removed ?? []).map((item, i) => (
          <li key={`r${i}`} className="removed">{render(item)}</li>
        ))}
        {(data.changed ?? []).map((item, i) => (
          <li key={`c${i}`} className="changed">
            {typeof item === 'string' ? (
              item
            ) : (
              <>
                <strong>{item.title}</strong>
                <ul className="compare-changes">
                  {item.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The side-by-side summary of what differs between two projects.
export default function DiffResults({ diff }) {
  if (diff.identical) {
    return <p className="compare-identical">No differences found between these two projects.</p>;
  }
  return (
    <>
      {diff.meta.changes.length > 0 && (
        <section className="compare-section">
          <h3>Project</h3>
          <ul>
            {diff.meta.changes.map((change) => (
              <li key={change} className="changed">{change}</li>
            ))}
          </ul>
        </section>
      )}
      {SECTIONS.map(({ key, title }) => (
        <SectionDetails key={key} sectionKey={key} title={title} diff={diff} />
      ))}
    </>
  );
}

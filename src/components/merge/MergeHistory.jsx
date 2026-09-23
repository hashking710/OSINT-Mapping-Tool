const formatWhen = (iso) => (typeof iso === 'string' ? iso.slice(0, 16).replace('T', ' ') : '');

export default function MergeHistory({ entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <details className="merge-history" data-testid="merge-history">
      <summary>Merge history ({entries.length})</summary>
      <ul>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="merge-history-when">{formatWhen(entry.at)}</span>
            <span>
              {entry.source ? `From ${entry.source}: ` : ''}
              {entry.text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

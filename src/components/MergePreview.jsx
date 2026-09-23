import { useMemo } from 'react';
import { PREVIEW_NODE_HEIGHT, PREVIEW_NODE_WIDTH, buildMergePreview } from '../utils/mergePreview.js';
import { getPinColor } from '../pinColors.js';

const clip = (text, max = 26) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Read-only picture of the project as it would look after the merge.
export default function MergePreview({ base, merged }) {
  const preview = useMemo(() => buildMergePreview(base, merged), [base, merged]);
  const { nodes, edges, bounds, counts } = preview;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (nodes.length === 0) return <p className="merge-note">There are no identifiers to show yet.</p>;

  return (
    <div className="merge-preview" data-testid="merge-preview-box">
      <div className="merge-preview-legend">
        <span className="legend-item added">New ({counts.addedNodes})</span>
        <span className="legend-item updated">Changed ({counts.updatedNodes})</span>
        <span className="legend-item same">Unchanged</span>
        <span className="legend-note">Dashed lines are new connections</span>
      </div>
      <div className="merge-preview-scroll">
      <svg
        className="merge-preview-svg"
        data-testid="merge-preview"
        style={{ minWidth: Math.round(bounds.width * 0.62), aspectRatio: `${bounds.width} / ${bounds.height}` }}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        role="img"
        aria-label={`Preview of the merged project: ${nodes.length} identifiers, ${edges.length} connections`}
      >
        {edges.map((edge) => {
          const a = byId.get(edge.source);
          const b = byId.get(edge.target);
          if (!a || !b) return null;
          return (
            <g key={edge.id} className={`mp-edge ${edge.status}`} data-status={edge.status}>
              <line
                x1={a.x + PREVIEW_NODE_WIDTH / 2}
                y1={a.y + PREVIEW_NODE_HEIGHT / 2}
                x2={b.x + PREVIEW_NODE_WIDTH / 2}
                y2={b.y + PREVIEW_NODE_HEIGHT / 2}
              />
            </g>
          );
        })}
        {nodes.map((node) => (
          <g key={node.id} className={`mp-node ${node.status}`} data-status={node.status} transform={`translate(${node.x} ${node.y})`}>
            <rect width={PREVIEW_NODE_WIDTH} height={PREVIEW_NODE_HEIGHT} rx="10" />
            {node.color && <rect className="mp-stripe" width="6" height={PREVIEW_NODE_HEIGHT} rx="3" style={{ fill: getPinColor(node.color).bg }} />}
            <text className="mp-type" x="14" y="21">{node.type}</text>
            <text className="mp-label" x="14" y="42">{clip(node.label, 22)}</text>
          </g>
        ))}
        {edges.map((edge) => {
          const a = byId.get(edge.source);
          const b = byId.get(edge.target);
          if (!a || !b || !edge.label) return null;
          const mx = (a.x + b.x + PREVIEW_NODE_WIDTH) / 2;
          const my = (a.y + b.y + PREVIEW_NODE_HEIGHT) / 2;
          return (
            <text key={`label-${edge.id}`} className={`mp-edge-label ${edge.status}`} x={mx} y={my - 6} textAnchor="middle">
              {clip(edge.label, 22)}
            </text>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

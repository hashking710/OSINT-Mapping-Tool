import { Fragment } from 'react';

// Guidance drawn over the canvas: a welcome card while it is empty, and a
// one-line keyboard tip strip once it has content.
export default function CanvasHints({ hasIdentifiers }) {
  if (!hasIdentifiers) {
    return (
      <div className="canvas-hint">
        <h3>Empty canvas</h3>
        <p>
          Add identifiers from the sidebar, or <strong>right-click</strong> on the canvas to add one here. They&apos;ll
          appear as nodes you can drag and connect.
        </p>
        <p className="canvas-hint-tips">
          <strong>Drag a handle</strong> to another node to connect them, or to empty space to add a new node.<br />
          <strong>Double-click</strong> a node to edit.<br />
          <strong>Select</strong> and press <kbd>Delete</kbd> / <kbd>Backspace</kbd> to remove a node or edge.
        </p>
      </div>
    );
  }

  const tips = [
    <><kbd>Drag handle</kbd> &rarr; new node</>,
    <><kbd>Double-click</kbd> a line to label it</>,
    <><kbd>Right-click</kbd> menu</>,
    <><kbd>&#8984;D</kbd> duplicate</>,
    <><kbd>&#8984;Z</kbd> / <kbd>&#8984;Y</kbd></>,
    <><kbd>Del</kbd> remove</>,
  ];
  return (
    <div className="canvas-tips" aria-hidden="true">
      {tips.map((tip, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="canvas-tips-sep">&middot;</span>}
          <span>{tip}</span>
        </Fragment>
      ))}
    </div>
  );
}

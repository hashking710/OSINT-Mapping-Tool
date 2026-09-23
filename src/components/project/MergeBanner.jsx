import { describeMergeSummary } from '../../utils/mergeSummary.js';

// Shown after a merge until the next edit, with a one-click undo.
export default function MergeBanner({ mergeUndo, onUndo, onDismiss }) {
  if (!mergeUndo) return null;
  return (
    <div className="merge-banner" role="status" data-testid="merge-banner">
      <span>Merged from file: {describeMergeSummary(mergeUndo.summary)}</span>
      <button type="button" onClick={onUndo}>Undo</button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>&times;</button>
    </div>
  );
}

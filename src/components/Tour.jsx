import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { markTourSeen } from '../utils/tourState.js';
import './Tour.css';

const STEPS = [
  {
    target: '#info-panel .sidebar-header',
    title: 'Your identifiers',
    body: 'Add people, accounts, emails, phones and more here, or import them from a CSV. Press / to search, and use Select for bulk actions and labels.',
  },
  {
    target: '#info-panel .react-flow',
    title: 'Connect the dots',
    body: 'Drag from a node’s dot to another node to link them, double-click a line to describe the relationship, and right-click empty space to add nodes. Tidy layout arranges everything.',
  },
  {
    target: '.tab-switcher',
    title: 'Information and Map',
    body: 'Switch tabs with a click or Alt+1 / Alt+2. Pins on the map can be linked back to identifiers.',
  },
  {
    target: '.export-menu',
    title: 'Export and save',
    body: 'Export a report, print it to PDF, or download CSVs. Ctrl/⌘+S saves the project file; the orange dot on Save means unsaved changes.',
  },
  {
    target: '.shortcuts-btn',
    fallback: '.project-topbar',
    title: 'Shortcuts',
    body: 'On a keyboard, press ? any time for every shortcut. You can replay this tour from there.',
  },
];

function findTarget(step) {
  for (const selector of [step.target, step.fallback].filter(Boolean)) {
    const el = document.querySelector(selector);
    if (!el || el.getClientRects().length === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
  }
  return null;
}

const sameRect = (a, b) =>
  a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

export default function Tour({ onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardHeight, setCardHeight] = useState(190);
  const cardRef = useRef(null);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    markTourSeen();
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (index === STEPS.length - 1) finish();
    else setIndex((i) => i + 1);
  }, [index, finish]);

  // Track the target's position; skip a step whose target never appears
  // (for example a control hidden on small screens).
  useEffect(() => {
    let misses = 0;
    setRect(null);
    const measure = () => {
      const found = findTarget(step);
      if (found) {
        misses = 0;
        setRect((prev) => (sameRect(prev, found) ? prev : found));
      } else {
        misses += 1;
        if (misses > 8) next();
      }
    };
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [step, next]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, rect]);

  if (!rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(340, vw - 24);
  let top = rect.top + rect.height + 14;
  if (top + cardHeight > vh - 12) top = rect.top - cardHeight - 14;
  if (top < 12) top = Math.max(12, vh - cardHeight - 12);
  const left = Math.min(Math.max(rect.left, 12), vw - cardWidth - 12);

  return (
    <>
      <div
        className="tour-ring"
        aria-hidden="true"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-label="Quick tour"
        style={{ top, left, width: cardWidth }}
      >
        <div className="tour-step">
          {index + 1} of {STEPS.length}
        </div>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finish}>
            Skip tour
          </button>
          <div className="tour-nav">
            {index > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={next}>
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

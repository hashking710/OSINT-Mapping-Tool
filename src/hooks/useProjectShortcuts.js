import { useEffect } from 'react';

const isTypingTarget = (el) =>
  !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// Project-wide keyboard shortcuts: save, tab switching, jump to search, help.
// (Undo/redo/duplicate live with the canvas, in InfoTab.)
export function useProjectShortcuts({ tab, setTab, saveProject, toggleHelp, closeHelp }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveProject();
        return;
      }
      if (event.key === 'Escape') {
        closeHelp();
        return;
      }
      if (event.altKey && (event.key === '1' || event.key === '2')) {
        event.preventDefault();
        setTab(event.key === '1' ? 'info' : 'map');
        return;
      }
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === '/') {
        const pane = document.getElementById(tab === 'info' ? 'info-panel' : 'map-panel');
        const input = pane?.querySelector('.identifier-search, .map-search-input');
        if (!input) return;
        event.preventDefault();
        // On phones the sidebar may be collapsed; expand it so the input can take focus.
        if (input.offsetParent === null) pane.querySelector('.sidebar-toggle')?.click();
        window.setTimeout(() => input.focus(), 0);
      } else if (event.key === '?') {
        event.preventDefault();
        toggleHelp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveProject, setTab, tab, toggleHelp, closeHelp]);
}

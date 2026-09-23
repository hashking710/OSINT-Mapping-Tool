import { useState } from 'react';

// On phone-width screens the sidebar stacks above the canvas/map; collapsing it
// gives the canvas nearly the full height. Starts collapsed on small screens.
export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 720px)').matches,
  );
  return [collapsed, () => setCollapsed((value) => !value)];
}

export function SidebarTitle({ title, count, collapsed, onToggle }) {
  return (
    <div className="sidebar-title">
      <button
        type="button"
        className="sidebar-toggle"
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Show' : 'Hide'} ${title.toLowerCase()} list`}
        onClick={onToggle}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <h3>{title}</h3>
      {collapsed && count > 0 && <span className="sidebar-count">{count}</span>}
    </div>
  );
}

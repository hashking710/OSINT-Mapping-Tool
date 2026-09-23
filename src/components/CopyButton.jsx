import { useEffect, useRef, useState } from 'react';

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('copy command rejected');
}

export default function CopyButton({ text, label = 'Copy link', className = '' }) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      try {
        legacyCopy(text);
        setState('copied');
      } catch {
        setState('failed');
      }
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState('idle'), 1500);
  };

  return (
    <button type="button" className={`copy-button ${className}`.trim()} onClick={copy}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}

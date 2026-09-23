import { useMemo, useState } from 'react';
import { readProjectFromFile } from '../utils/projectIO.js';
import { combineProjects } from '../utils/projectMerge.js';

// The files a merge draws from, kept in order. Several files are combined into
// one incoming project (later files win where they disagree), so the merge
// review always deals with a single source.
export function useMergeSources() {
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');

  const addFiles = async (files) => {
    const loaded = [];
    let firstError = '';
    for (const file of files) {
      try {
        loaded.push({ fileName: file.name, project: await readProjectFromFile(file) });
      } catch (err) {
        if (!firstError) firstError = `Could not read ${file.name}: ${err.message}`;
      }
    }
    if (loaded.length) setSources((existing) => [...existing, ...loaded]);
    setError(firstError);
  };

  const remove = (index) => setSources((existing) => existing.filter((_, i) => i !== index));

  const move = (index, delta) =>
    setSources((existing) => {
      const target = index + delta;
      if (target < 0 || target >= existing.length) return existing;
      const next = [...existing];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const names = sources.map((s) => s.fileName).join(', ');
  const combined = useMemo(() => (sources.length ? combineProjects(sources.map((s) => s.project)) : null), [sources]);

  return {
    sources,
    names,
    slot: combined ? { fileName: names, project: combined } : null,
    error,
    addFiles,
    remove,
    move,
  };
}

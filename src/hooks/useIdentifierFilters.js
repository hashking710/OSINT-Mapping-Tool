import { useCallback, useMemo, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import {
  collectColors,
  collectTags,
  filterIdentifiersByLabels,
} from '../utils/identifierLabels.js';
import { filterIdentifiersForQuery } from '../utils/identifierSearch.js';

const NO_DIMMED = new Set();

// Everything the Information sidebar filters by: text search, tag/colour
// chips, saved views and tag grouping, plus what those imply for the canvas
// (which nodes dim while a filter is active).
export function useIdentifierFilters(identifiers) {
  const { project, addFilterPreset } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState({ tag: null, color: null });
  const [groupByTag, setGroupByTag] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [presetDraft, setPresetDraft] = useState(null);

  const allTags = useMemo(() => collectTags(identifiers), [identifiers]);
  const usedColors = useMemo(() => collectColors(identifiers), [identifiers]);
  // A remembered tag or colour that no identifier carries any more is ignored.
  const activeLabelFilter = useMemo(
    () => ({
      tag: allTags.some((t) => t.tag.toLowerCase() === (labelFilter.tag ?? '').toLowerCase()) ? labelFilter.tag : null,
      color: usedColors.includes(labelFilter.color) ? labelFilter.color : null,
    }),
    [allTags, usedColors, labelFilter],
  );
  const filteredIdentifiers = useMemo(
    () => filterIdentifiersByLabels(filterIdentifiersForQuery(identifiers, searchQuery), activeLabelFilter),
    [identifiers, searchQuery, activeLabelFilter],
  );
  const filtersActive = !!(searchQuery.trim() || activeLabelFilter.tag || activeLabelFilter.color);
  const dimmedIds = useMemo(() => {
    if (!filtersActive) return NO_DIMMED;
    const visible = new Set(filteredIdentifiers.map((i) => i.id));
    return new Set(identifiers.filter((i) => !visible.has(i.id)).map((i) => i.id));
  }, [filtersActive, filteredIdentifiers, identifiers]);

  const toggleNodeTag = useCallback((tag) => {
    setLabelFilter((f) => ({
      ...f,
      tag: f.tag && f.tag.toLowerCase() === tag.toLowerCase() ? null : tag,
    }));
  }, []);

  const toggleGroup = (name) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const presets = project?.filterPresets ?? [];
  const applyPreset = (preset) => {
    setSearchQuery(preset.query ?? '');
    setLabelFilter({ tag: preset.tag ?? null, color: preset.color ?? null });
  };
  const isPresetActive = (preset) =>
    (preset.query ?? '') === searchQuery.trim() &&
    (preset.tag ?? null)?.toLowerCase() === (activeLabelFilter.tag ?? null)?.toLowerCase() &&
    (preset.color ?? null) === activeLabelFilter.color;
  const savePreset = (event) => {
    event.preventDefault();
    const name = (presetDraft ?? '').trim();
    if (!name) return;
    addFilterPreset({
      name,
      query: searchQuery.trim(),
      tag: activeLabelFilter.tag,
      color: activeLabelFilter.color,
    });
    setPresetDraft(null);
  };

  return {
    searchQuery,
    setSearchQuery,
    setLabelFilter,
    groupByTag,
    setGroupByTag,
    collapsedGroups,
    toggleGroup,
    allTags,
    usedColors,
    activeLabelFilter,
    filteredIdentifiers,
    filtersActive,
    dimmedIds,
    toggleNodeTag,
    presets,
    presetDraft,
    setPresetDraft,
    applyPreset,
    isPresetActive,
    savePreset,
  };
}

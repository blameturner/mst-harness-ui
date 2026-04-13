import { useState, useCallback } from 'react';
import type { LlmModel } from '../../../api/types/LlmModel';
import type { StyleSurface } from '../../../api/types/StyleSurface';
import type { Mode } from '../types/Mode';
import type { ComposerToggle } from '../../../components/ComposerToggle';

export interface CodeConfig {
  models: LlmModel[];
  setModels: (v: LlmModel[]) => void;
  model: string;
  setModel: (v: string) => void;

  codeStyles: StyleSurface | null;
  setCodeStyles: (v: StyleSurface | null) => void;
  styleKey: string;
  setStyleKey: (v: string) => void;

  mode: Mode;
  setMode: (v: Mode) => void;

  ragEnabled: boolean;
  setRagEnabled: (fn: (v: boolean) => boolean) => void;
  knowledgeEnabled: boolean;
  setKnowledgeEnabled: (fn: (v: boolean) => boolean) => void;

  searchEnabled: boolean;
  setSearchEnabled: (fn: (v: boolean) => boolean) => void;
  searchSuppressed: boolean;
  setSearchSuppressed: (fn: (v: boolean) => boolean) => void;

  useCodebase: boolean;
  setUseCodebase: (fn: (v: boolean) => boolean) => void;
  codebaseCollection: string;
  setCodebaseCollection: (v: string) => void;

  buildToggles: () => ComposerToggle[];
}

export function useCodeConfig(): CodeConfig {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');

  const [codeStyles, setCodeStyles] = useState<StyleSurface | null>(null);
  const [styleKey, setStyleKey] = useState<string>('');

  const [mode, setMode] = useState<Mode>('plan');

  const [ragEnabled, setRagEnabled] = useState(false);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);

  const [searchEnabled, setSearchEnabled] = useState(false);
  const [searchSuppressed, setSearchSuppressed] = useState(false);

  const [useCodebase, setUseCodebase] = useState(false);
  const [codebaseCollection, setCodebaseCollection] = useState('');

  const buildToggles = useCallback((): ComposerToggle[] => [
    {
      key: 'memory',
      label: 'Memory',
      active: ragEnabled,
      title: 'Per-conversation recall (first turn only)',
      onToggle: () => setRagEnabled((v) => !v),
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      active: knowledgeEnabled,
      title: 'Graph extraction + shared knowledge (first turn only)',
      onToggle: () => setKnowledgeEnabled((v) => !v),
    },
    {
      key: 'codebase',
      label: useCodebase && codebaseCollection ? `Codebase · ${codebaseCollection}` : 'Codebase',
      active: useCodebase,
      title: 'Inject codebase search results into each turn',
      onToggle: () => setUseCodebase((v) => !v),
    },
    {
      key: 'search',
      label: 'Web Search',
      active: searchEnabled,
      title: 'Turn off to stop the model retrieving information from the internet',
      onToggle: () => setSearchEnabled((v) => !v),
    },
  ], [ragEnabled, knowledgeEnabled, useCodebase, codebaseCollection, searchEnabled]);

  return {
    models, setModels, model, setModel,
    codeStyles, setCodeStyles, styleKey, setStyleKey,
    mode, setMode,
    ragEnabled, setRagEnabled, knowledgeEnabled, setKnowledgeEnabled,
    searchEnabled, setSearchEnabled, searchSuppressed, setSearchSuppressed,
    useCodebase, setUseCodebase, codebaseCollection, setCodebaseCollection,
    buildToggles,
  };
}


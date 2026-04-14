import { useState } from 'react';
import type { LlmModel } from '../../../api/types/LlmModel';
import type { StyleOption } from '../../../api/types/StyleOption';
import type { StyleSurface } from '../../../api/types/StyleSurface';
import type { ComposerToggle } from '../../../components/ComposerToggle';

export interface ChatConfig {
  models: LlmModel[];
  model: string;
  setModel: (v: string) => void;
  setModels: (v: LlmModel[]) => void;

  chatStyles: StyleSurface | null;
  setChatStyles: (v: StyleSurface | null) => void;
  styleKey: string;
  setStyleKey: (v: string) => void;

  ragEnabled: boolean;
  setRagEnabled: (fn: (v: boolean) => boolean) => void;
  knowledgeEnabled: boolean;
  setKnowledgeEnabled: (fn: (v: boolean) => boolean) => void;

  searchSuppressed: boolean;
  setSearchSuppressed: (fn: (v: boolean) => boolean) => void;

  alwaysAllowSearch: boolean;
  setAlwaysAllowSearch: (fn: (v: boolean) => boolean) => void;

  grounding: boolean;
  setGrounding: (v: boolean) => void;

  buildToggles: (activeId: number | null) => ComposerToggle[];
}

export function useChatConfig(): ChatConfig {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');

  const [chatStyles, setChatStyles] = useState<StyleSurface | null>(null);
  const [styleKey, setStyleKey] = useState<string>('');

  const [ragEnabled, setRagEnabled] = useState(false);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);

  const [searchSuppressed, setSearchSuppressed] = useState(false);

  const [alwaysAllowSearch, setAlwaysAllowSearch] = useState(true);
  const [grounding, setGrounding] = useState(true);

  function buildToggles(activeId: number | null): ComposerToggle[] {
    return [
      {
        key: 'memory',
        label: 'Memory',
        active: ragEnabled,
        disabled: activeId != null,
        title:
          activeId != null
            ? 'Memory is set when a conversation is first created'
            : 'Use past conversations as context',
        onToggle: () => setRagEnabled((v) => !v),
      },
      {
        key: 'knowledge',
        label: 'Knowledge',
        active: knowledgeEnabled,
        disabled: activeId != null,
        title:
          activeId != null
            ? 'Knowledge graph is set when a conversation is first created'
            : 'Extract entities and write concept edges to the knowledge graph',
        onToggle: () => setKnowledgeEnabled((v) => !v),
      },
    ];
  }

  return {
    models, model, setModel, setModels,
    chatStyles, setChatStyles, styleKey, setStyleKey,
    ragEnabled, setRagEnabled, knowledgeEnabled, setKnowledgeEnabled,
    searchSuppressed, setSearchSuppressed,
    alwaysAllowSearch, setAlwaysAllowSearch,
    grounding, setGrounding,
    buildToggles,
  };
}

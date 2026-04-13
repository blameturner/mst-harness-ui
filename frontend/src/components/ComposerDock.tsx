import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { LlmModel } from '../api/types/LlmModel';
import type { StyleOption } from '../api/types/StyleOption';
import { styleLabel } from '../lib/styles/styleLabel';
import { Select } from './Select';
import type { ComposerToggle } from './ComposerToggle';

interface ComposerDockProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;

  models: LlmModel[];
  model: string;
  onModelChange: (v: string) => void;
  styles?: StyleOption[];
  styleKey?: string;
  onStyleChange?: (k: string) => void;
  toggles?: ComposerToggle[];
  leftRailSlot?: ReactNode;
  onAttach?: (files: File[]) => void;
  attachmentPreview?: ReactNode;
  searchSuppressed?: boolean;
  onToggleSearchSuppressed?: () => void;
}

export function ComposerDock({
  value,
  onChange,
  onSend,
  onStop,
  sending,
  disabled,
  placeholder,
  models,
  model,
  onModelChange,
  styles,
  styleKey,
  onStyleChange,
  toggles,
  leftRailSlot,
  onAttach,
  attachmentPreview,
  searchSuppressed,
  onToggleSearchSuppressed,
}: ComposerDockProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !sending && value.trim()) onSend();
    }
  }

  function onFilesPicked(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0 && onAttach) onAttach(picked);
    e.target.value = '';
  }


  const railVisible = mobileRailOpen;

  return (
    <div className="border-t border-border bg-bg/95 backdrop-blur">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fg/20 to-transparent" />
        <div
          className={[
            'px-3 sm:px-5 pt-2 sm:pt-3 pb-2 items-stretch gap-3 sm:gap-5 flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar',
            railVisible ? 'flex' : 'hidden sm:flex',
          ].join(' ')}
        >
          {leftRailSlot && (
            <>
              <DockZone label="Mode">{leftRailSlot}</DockZone>
              <Divider />
            </>
          )}
          <DockZone label="Model">
            <Select
              value={model}
              onChange={(v) => onModelChange(v)}
              placeholder="No models"
              options={models.map((m) => ({
                value: m.name,
                label: m.name,
                hint: m.role,
                description: m.model_id,
              }))}
            />
          </DockZone>

          {styles && styles.length > 0 && (
            <>
              <Divider />
              <DockZone label="Style">
                <Select
                  value={styleKey ?? ''}
                  onChange={(v) => onStyleChange?.(v)}
                  placeholder="Pick style"
                  options={styles.map((s) => ({
                    value: s.key,
                    label: styleLabel(s.key),
                    description: s.prompt,
                  }))}
                  leading={<span className="w-1.5 h-1.5 rounded-full bg-fg/70" />}
                />
              </DockZone>
            </>
          )}

          {toggles && toggles.length > 0 && (
            <>
              <Divider />
              <DockZone label="Context">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {toggles.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={t.onToggle}
                      disabled={t.disabled}
                      title={t.title}
                      className={[
                        'text-[11px] font-sans px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5',
                        t.disabled
                          ? 'border-border text-muted opacity-50 cursor-not-allowed'
                          : t.active
                            ? 'border-fg bg-fg text-bg'
                            : 'border-border text-muted hover:border-fg hover:text-fg',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'w-1.5 h-1.5 rounded-full',
                          t.active ? 'bg-bg' : 'bg-border',
                        ].join(' ')}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
              </DockZone>
            </>
          )}

          <div className="flex-1" />
        </div>
      </div>

      <div className="px-3 sm:px-5 pt-1 pb-3 sm:pb-4">
        {attachmentPreview && <div className="mb-2">{attachmentPreview}</div>}
        <div className="flex items-end gap-3 border border-border rounded-xl bg-panel/40 focus-within:border-fg transition-colors px-4 py-3 shadow-card">
          <button
            type="button"
            onClick={() => setMobileRailOpen((v) => !v)}
            aria-expanded={mobileRailOpen}
            aria-label={mobileRailOpen ? 'Hide options' : 'Show options'}
            className="sm:hidden shrink-0 w-9 h-9 rounded-md border border-border text-muted hover:border-fg hover:text-fg transition-colors flex items-center justify-center"
            title="Options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          {onAttach && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-md border border-border text-muted hover:border-fg hover:text-fg transition-colors flex items-center justify-center font-sans text-[13px]"
                title="Attach files"
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFilesPicked}
                className="hidden"
              />
            </>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder ?? 'Type a message…'}
            disabled={disabled || sending}
            className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed placeholder:text-muted disabled:opacity-50 min-h-[1.6em] max-h-[220px] overflow-y-auto"
          />
          {sending && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="shrink-0 px-4 py-2 rounded-md border border-fg text-fg text-sm font-medium tracking-wide hover:bg-fg hover:text-bg transition-colors flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 bg-current rounded-[1px]" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleSearchSuppressed && (
                <button
                  type="button"
                  onClick={onToggleSearchSuppressed}
                  title={searchSuppressed ? 'Search disabled for this message — click to re-enable' : 'Skip web search for this message'}
                  className={[
                    'px-2.5 py-2 rounded-md text-[11px] font-sans tracking-wide transition-colors border',
                    searchSuppressed
                      ? 'border-red-600/50 text-red-500 bg-red-500/10 hover:bg-red-500/20'
                      : 'border-border text-muted hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={searchSuppressed ? 'opacity-100' : 'opacity-60'}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    {searchSuppressed && <line x1="4" y1="4" x2="18" y2="18" />}
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onSend}
                disabled={disabled || sending || !value.trim()}
                className="shrink-0 px-4 py-2 rounded-md bg-fg text-bg text-sm font-medium tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}
        </div>
        <p className="hidden sm:block text-[10px] uppercase tracking-[0.14em] text-muted font-sans mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>

    </div>
  );
}

function DockZone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-sans pl-0.5">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="self-stretch w-px bg-border my-1" aria-hidden />;
}

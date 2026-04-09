import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { LlmModel, StyleOption } from '../lib/api';
import { styleLabel } from '../lib/styles';

export interface ComposerToggle {
  key: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}

interface ComposerDockProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;

  models: LlmModel[];
  model: string;
  onModelChange: (v: string) => void;

  /** Available response-style presets for this surface. */
  styles?: StyleOption[];
  styleKey?: string;
  onStyleChange?: (k: string) => void;

  /** Pill-group toggles (memory / knowledge / search, etc.). */
  toggles?: ComposerToggle[];

  /** Optional custom slot rendered at the far left of the control rail
   *  (used by the code page for the Plan/Execute/Debug segmented switch). */
  leftRailSlot?: ReactNode;

  /** Optional file attach support. When `onAttach` is set, the paperclip
   *  button is rendered and files picked are forwarded as a raw FileList. */
  onAttach?: (files: File[]) => void;
  attachmentPreview?: ReactNode;
}

/**
 * The dock is the command centre of both chat and code — it holds the model,
 * style, memory/knowledge/search toggles, the optional mode switcher, the
 * file attach control, and the message composer. It's intentionally
 * "instrument-panel" flavoured: two stacked rows, thin dividers between
 * zones, tiny mono labels floating above each control. Cohesive with the
 * rest of the app (font-display / font-mono / border-border / panel tokens)
 * but pushes the density and structure further than the prior inline rail.
 */
export function ComposerDock({
  value,
  onChange,
  onSend,
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
}: ComposerDockProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);

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

  const activeStyle = styles?.find((s) => s.key === styleKey);

  return (
    <div className="border-t border-border bg-bg/95 backdrop-blur">
      {/* Top control rail ----------------------------------------------------- */}
      <div className="relative">
        {/* subtle highlight rule */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fg/20 to-transparent" />
        <div className="px-3 sm:px-5 pt-2 sm:pt-3 pb-2 flex items-stretch gap-3 sm:gap-5 overflow-x-auto no-scrollbar">
          {/* ——— Left slot (e.g. mode switcher for code) ——— */}
          {leftRailSlot && (
            <>
              <DockZone label="Mode">{leftRailSlot}</DockZone>
              <Divider />
            </>
          )}

          {/* ——— Model ——— */}
          <DockZone label="Model">
            <div className="relative">
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="appearance-none bg-panel/60 border border-border hover:border-fg/60 focus:border-fg focus:outline-none pl-2.5 pr-7 py-1.5 rounded text-[12px] font-mono text-fg transition-colors cursor-pointer"
              >
                {models.length === 0 ? (
                  <option value="">No models</option>
                ) : (
                  models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))
                )}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[10px]">
                ▾
              </span>
            </div>
          </DockZone>

          {/* ——— Style picker ——— */}
          {styles && styles.length > 0 && (
            <>
              <Divider />
              <DockZone label="Style">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStyleOpen((v) => !v)}
                    title={activeStyle?.prompt ?? undefined}
                    className="bg-panel/60 border border-border hover:border-fg/60 px-2.5 py-1.5 rounded text-[12px] font-mono text-fg transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-fg/70" />
                    {styleLabel(styleKey) || 'Pick style'}
                    <span className="text-muted text-[10px] ml-0.5">▾</span>
                  </button>
                  {styleOpen && (
                    <>
                      {/* click-away backdrop */}
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setStyleOpen(false)}
                        className="fixed inset-0 z-40 cursor-default"
                      />
                      <div className="absolute z-50 bottom-full mb-2 left-0 min-w-[220px] max-h-[320px] overflow-y-auto border border-border bg-bg shadow-2xl rounded-md py-1">
                        {styles.map((s) => {
                          const active = s.key === styleKey;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => {
                                onStyleChange?.(s.key);
                                setStyleOpen(false);
                              }}
                              title={s.prompt}
                              className={[
                                'w-full text-left px-3 py-1.5 text-[12px] font-mono flex items-center gap-2 transition-colors',
                                active
                                  ? 'bg-panelHi text-fg'
                                  : 'text-muted hover:bg-panel hover:text-fg',
                              ].join(' ')}
                            >
                              <span
                                className={[
                                  'w-1.5 h-1.5 rounded-full',
                                  active ? 'bg-fg' : 'bg-border',
                                ].join(' ')}
                              />
                              <span className="flex-1 truncate">{styleLabel(s.key)}</span>
                              {active && (
                                <span className="text-[9px] uppercase tracking-[0.14em] text-muted">
                                  active
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </DockZone>
            </>
          )}

          {/* ——— Toggles ——— */}
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
                        'text-[11px] font-mono px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5',
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

      {/* Composer row ---------------------------------------------------------- */}
      <div className="px-3 sm:px-5 pt-1 pb-3 sm:pb-4">
        {attachmentPreview && <div className="mb-2">{attachmentPreview}</div>}
        <div className="flex items-end gap-3 border border-border rounded-xl bg-panel/40 focus-within:border-fg transition-colors px-4 py-3 shadow-card">
          {onAttach && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-md border border-border text-muted hover:border-fg hover:text-fg transition-colors flex items-center justify-center font-mono text-[13px]"
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder ?? 'Type a message…'}
            disabled={disabled || sending}
            className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed placeholder:text-muted disabled:opacity-50 min-h-[1.6em] max-h-[220px]"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || sending || !value.trim()}
            className="shrink-0 px-4 py-2 rounded-md bg-fg text-bg text-sm font-medium tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-40"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-mono mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

/** A single labelled group of controls in the instrument-panel rail. */
function DockZone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-mono pl-0.5">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="self-stretch w-px bg-border my-1" aria-hidden />;
}

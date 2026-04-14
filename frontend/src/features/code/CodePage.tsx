import { useCallback, useEffect, useState } from 'react';
import type { Codebase } from '../../api/types/Codebase';
import { listModels } from '../../api/models/listModels';
import { listStyles } from '../../api/styles/listStyles';
import { listCodebases } from '../../api/codebases/listCodebases';
import { ComposerDock } from '../../components/ComposerDock';
import { Sheet } from '../../components/Sheet';
import { isTransientNetworkError } from '../../lib/network/isTransientNetworkError';
import { useOnVisibilityResume } from '../../hooks/useOnVisibilityResume';
import { useWasRecentlyHidden } from '../../hooks/useWasRecentlyHidden';
import { useAutoScrollToBottom } from '../chat/hooks/useAutoScrollToBottom';
import type { Mode } from './types/Mode';
import type { AttachedFile } from './types/AttachedFile';
import { DESTRUCTIVE_RE } from './constants/DESTRUCTIVE_RE';
import { CodeHeader } from './components/CodeHeader';
import { CodeMessagesArea } from './components/CodeMessagesArea';
import { CodePropertiesDrawer } from './components/CodePropertiesDrawer';
import { CodeRailBody } from './components/CodeRailBody';
import { CodebaseFilesFooter } from './components/CodebaseFilesFooter';
import { SidebarBody } from './SidebarBody';
import { useCodeConfig } from './hooks/useCodeConfig';
import { useCodeSessions } from './hooks/useCodeSessions';
import { useCodeMessaging } from './hooks/useCodeMessaging';
import { useFileAttachment } from './hooks/useFileAttachment';
import { usePlanChecklist } from './hooks/usePlanChecklist';
import { useSessionResume } from './hooks/useSessionResume';
import { groupCodeBlocksByMessage } from './utils/groupCodeBlocksByMessage';
import { parseCodeBlocks } from './utils/parseCodeBlocks';
import { utf8ToB64 } from './utils/utf8ToB64';

const STARTER_PROMPTS: Record<Mode, string[]> = {
  plan: [
    'Outline a migration from Express to Fastify for this repo',
    'Plan adding JWT auth to the attached server.js',
    'Break down refactoring this file into pure functions',
  ],
  execute: [
    'Implement step 1 from the approved plan',
    'Write the tests for the happy path',
    'Apply the plan to server.js and show the full file',
  ],
  explain: [
    'Explain what this function does line by line',
    'Walk me through how this code handles auth',
    'What does this regex pattern match?',
  ],
  review: [
    'Review this code for security vulnerabilities',
    'Suggest improvements for performance',
    'Check for code smells and best practices',
  ],
};

export function CodePage() {
  // ========== Config & Sessions State ==========
  const config = useCodeConfig();
  const sessions = useCodeSessions();
  const checklist = usePlanChecklist();
  const fileAttachment = useFileAttachment();
  const { autoResumeTriedRef, resumeCodeStream } = useSessionResume();

  // ========== Bootstrap ==========
  const vis = useWasRecentlyHidden();
  const [booted, setBooted] = useState(false);

  // ========== UI State ==========
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ========== Messaging ==========
  const messaging = useCodeMessaging(
    config.model,
    config.mode,
    sessions.conversationId,
    fileAttachment.files,
    config.ragEnabled,
    config.knowledgeEnabled,
    config.searchEnabled,
    config.searchSuppressed,
    config.useCodebase,
    config.codebaseCollection,
    config.styleKey,
    config.setMode,
    sessions.refreshSessions,
    vis.isHidden,
    vis.justResumed,
    sessions.rememberActiveSession,
    sessions.setConversationId,
    config.setMode,
    checklist.checklist,
    checklist.setChecklist,
    checklist.setChecked,
  );

  // ========== Auto-scroll ==========
  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScrollToBottom(messaging.messages);

  // ========== Load models & styles on mount ==========
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, stylesRes, codebasesRes] = await Promise.all([
          listModels(),
          listStyles('code').catch(() => null),
          listCodebases().catch(() => ({ codebases: [] })),
        ]);
        if (cancelled) return;
        config.setModels(res.models);
        const coder = res.models.find((m) => m.role === 'coder');
        if (coder || res.models[0]) {
          config.setModel((prev: string) => prev || coder?.name || res.models[0].name);
        }
        if (stylesRes?.code) {
          config.setCodeStyles(stylesRes.code);
          config.setStyleKey((prev: string) => prev || stylesRes.code!.default);
        }
        setBooted(true);
      } catch (err) {
        if (cancelled) return;
        if (isTransientNetworkError(err)) return;
        messaging.setError((err as Error)?.message ?? 'Failed to load models');
      }
    })();
    return () => {
      cancelled = true;
      messaging.streamAbortRef.current?.abort();
      if (messaging.retryTimerRef.current) {
        clearTimeout(messaging.retryTimerRef.current);
        messaging.retryTimerRef.current = null;
      }
    };
  }, []);

  useOnVisibilityResume(() => {
    if (!booted) {
      void (async () => {
        try {
          const [res, stylesRes] = await Promise.all([
            listModels(),
            listStyles('code').catch(() => null),
          ]);
          config.setModels(res.models);
          const coder = res.models.find((m) => m.role === 'coder');
          config.setModel((prev: string) => prev || coder?.name || res.models[0]?.name || '');
          if (stylesRes?.code) {
            config.setCodeStyles(stylesRes.code);
            config.setStyleKey((prev: string) => prev || stylesRes.code!.default);
          }
          setBooted(true);
          messaging.setError(null);
        } catch {}
      })();
    }
    void sessions.refreshSessions();
  });

  // ========== Load sessions on mount ==========
  useEffect(() => {
    void sessions.refreshSessions();
  }, [sessions.refreshSessions]);

  // ========== Auto-resume session after tab navigation ==========
  useEffect(() => {
    if (autoResumeTriedRef.current) return;
    if (sessions.sessionsLoading) return;
    if (sessions.sessions.length === 0) return;
    autoResumeTriedRef.current = true;

    const stored = sessions.loadActiveCodeSession();
    if (!stored) return;

    const c = sessions.sessions.find((s) => s.Id === stored.id);
    if (!c) {
      sessions.rememberActiveSession(null);
      return;
    }

    if (stored.jobId) {
      void resumeCodeStream(
        c,
        stored.jobId,
        sessions.setConversationId,
        config.setMode,
        config.setModel,
        messaging.setMessages,
        messaging.setError,
        messaging.setSending,
        fileAttachment.setFiles,
        sessions.rememberActiveSession,
        messaging.scheduleCodeRetry,
        sessions.refreshSessions,
        messaging.streamAbortRef,
        checklist.setChecklist,
        checklist.setChecked,
      );
    } else {
      void selectSession(c);
    }
  }, [sessions.sessions, sessions.sessionsLoading]);

  // ========== Session management ==========
  async function selectSession(c: any) {
    await sessions.selectSession(c, {
      onSelect: async () => {
        messaging.setMessages([]);
        fileAttachment.setFiles([]);
        messaging.setApprovedPlan(null);
        checklist.reset();
        messaging.setError(null);
        if (c.mode) config.setMode(c.mode);
        if (c.model) config.setModel(c.model);
        try {
          const saved = window.localStorage.getItem(`codeStyle:${c.Id}`);
          if (saved) config.setStyleKey(saved);
          else if (config.codeStyles) config.setStyleKey(config.codeStyles.default);
        } catch {}
      },
    });
  }

  // ========== Code execution & block management ==========
  const lastAssistant = [...messaging.messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const lastBlocks = lastAssistant ? parseCodeBlocks(lastAssistant.content) : [];
  const fileTargeted = lastBlocks.filter((b) => b.file);
  const messageBlocks = groupCodeBlocksByMessage(messaging.messages);

  function applyAllBlocks() {
    const targeted = lastBlocks.filter((b) => b.file);
    if (targeted.length < 2) return;
    const merged: AttachedFile[] = [
      ...fileAttachment.files.filter((f) => !targeted.find((t) => t.file === f.name)),
      ...targeted.map((b) => ({
        name: b.file!,
        content: b.code,
        content_b64: utf8ToB64(b.code),
        size: b.code.length,
      })),
    ];
    fileAttachment.setFiles(merged);
  }

  async function runSandbox(code: string): Promise<string> {
    if (DESTRUCTIVE_RE.test(code)) {
      if (!window.confirm('This block looks destructive. Run anyway?')) {
        throw new Error('cancelled');
      }
    }
    const res = await fetch('/api/code/run', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return await res.text();
  }

  // ========== Render ==========
  const activeSession = sessions.conversationId != null
    ? sessions.sessions.find((s) => s.Id === sessions.conversationId)
    : null;

  return (
    <div className="h-full flex bg-bg text-fg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border flex-col bg-panel/20">
        <SidebarBody
          sessions={sessions.sessions}
          sessionsLoading={sessions.sessionsLoading}
          conversationId={sessions.conversationId}
          onNewSession={() => {
            sessions.newSession();
            messaging.setMessages([]);
            fileAttachment.setFiles([]);
            messaging.setApprovedPlan(null);
            checklist.reset();
            messaging.setError(null);
          }}
          onSelectSession={(c) => void selectSession(c)}
          onRenameSession={(c, next) => void sessions.renameSession(c, next).catch(() => {})}
          onDeleteSession={(id) => void sessions.deleteSession(id).catch(() => {})}
        />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet
        open={sessionsSheetOpen}
        side="left"
        onClose={() => setSessionsSheetOpen(false)}
        label="Code sessions"
      >
        <SidebarBody
          sessions={sessions.sessions}
          sessionsLoading={sessions.sessionsLoading}
          conversationId={sessions.conversationId}
          onNewSession={() => {
            sessions.newSession();
            messaging.setMessages([]);
            fileAttachment.setFiles([]);
            messaging.setApprovedPlan(null);
            checklist.reset();
            messaging.setError(null);
            setSessionsSheetOpen(false);
          }}
          onSelectSession={(c) => {
            void selectSession(c);
            setSessionsSheetOpen(false);
          }}
          onRenameSession={(c, next) => void sessions.renameSession(c, next).catch(() => {})}
          onDeleteSession={(id) => void sessions.deleteSession(id).catch(() => {})}
          onPick={() => setSessionsSheetOpen(false)}
        />
      </Sheet>

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col border-r border-border min-w-0"
        onDragOver={fileAttachment.onDragOver}
        onDragLeave={fileAttachment.onDragLeave}
        onDrop={(e) => void fileAttachment.onDrop(e)}
      >
        {/* Header */}
        <CodeHeader
          approvedPlan={messaging.approvedPlan}
          onClearPlan={() => messaging.setApprovedPlan(null)}
          onToggleSidebar={() => setSessionsSheetOpen(true)}
          onToggleOutput={() => setRailSheetOpen(true)}
          onToggleProperties={() => setDrawerOpen((v) => !v)}
          propertiesOpen={drawerOpen}
          lastBlocksCount={lastBlocks.length}
        />

        {/* Messages area */}
        <CodeMessagesArea
          messages={messaging.messages}
          mode={config.mode}
          model={config.model}
          dragOver={fileAttachment.dragOver}
          copiedMessageId={messaging.copiedMessageId}
          scrollRef={scrollRef}
          starterPrompts={STARTER_PROMPTS[config.mode]}
          onSetInput={messaging.setInput}
          onApprovePlan={messaging.approvePlan}
          onEdit={messaging.editUserMessage}
          onCopy={messaging.copyMessage}
          onRetry={messaging.retryMessage}
          isAtBottom={isAtBottom}
          onScrollToBottom={() => scrollToBottom(true)}
          error={messaging.error}
        />

        {/* Codebase & files footer */}
        <CodebaseFilesFooter
          useCodebase={config.useCodebase}
          codebases={config.codeStyles?.styles ? [] : []}
          codebaseCollection={config.codebaseCollection}
          onCodebaseChange={config.setCodebaseCollection}
          files={fileAttachment.files}
          onRemoveFile={fileAttachment.removeFile}
        />

        {/* Composer dock */}
        <ComposerDock
          value={messaging.input}
          onChange={messaging.setInput}
          onSend={() => void messaging.send()}
          onStop={() => messaging.streamAbortRef.current?.abort()}
          sending={messaging.sending}
          disabled={!config.model}
          placeholder={config.model ? `Describe the ${config.mode} task…` : 'Load a model to start'}
          models={config.models}
          model={config.model}
          onModelChange={config.setModel}
          styles={config.codeStyles?.styles}
          styleKey={config.styleKey}
          onStyleChange={(k) => {
            config.setStyleKey(k);
            if (sessions.conversationId != null) {
              try {
                window.localStorage.setItem(`codeStyle:${sessions.conversationId}`, k);
              } catch {}
            }
          }}
          toggles={config.buildToggles()}
          leftRailSlot={
            <div className="flex items-center border border-border rounded overflow-hidden text-[11px] font-sans bg-panel/60">
              {(['plan', 'execute', 'explain', 'review'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => config.setMode(m)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    config.mode === m ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          }
          onAttach={(picked) => void fileAttachment.addFiles(picked)}
          attachmentPreview={
            fileAttachment.files.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fileAttachment.files.map((f) => (
                  <span
                    key={f.name}
                    className="text-[11px] font-sans px-2 py-1 rounded border border-border bg-panel/60 flex items-center gap-2"
                  >
                    {f.name}
                    <span className="text-muted">{(f.size / 1024).toFixed(1)}K</span>
                    <button
                      onClick={() => fileAttachment.removeFile(f.name)}
                      className="text-muted hover:text-fg"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null
          }
          searchSuppressed={config.searchSuppressed}
          onToggleSearchSuppressed={() => config.setSearchSuppressed((v) => !v)}
        />
      </div>

      {/* Desktop rail */}
      <div className="hidden xl:flex w-2/5 max-w-[640px] flex-col bg-panel/20">
        <CodeRailBody
          checklist={checklist.checklist}
          checked={checklist.checked}
          onChecklistChange={(i, c) => checklist.setChecked((ch) => ({ ...ch, [i]: c }))}
          onStepPrompt={messaging.sendStepPrompt}
          messageBlocks={messageBlocks}
          codebases={[]}
          onCodebasesUpdate={() => {}}
          onApplyAll={applyAllBlocks}
          fileTargetedCount={fileTargeted.length}
          onRunSandbox={runSandbox}
        />
      </div>

      {/* Mobile rail sheet */}
      <Sheet
        open={railSheetOpen}
        side="right"
        onClose={() => setRailSheetOpen(false)}
        widthClass="w-[94vw] max-w-[640px]"
        mobileOnlyClass="xl:hidden"
        label="Code output"
      >
        <div className="flex flex-col h-full bg-bg">
          <CodeRailBody
            checklist={checklist.checklist}
            checked={checklist.checked}
            onChecklistChange={(i, c) => checklist.setChecked((ch) => ({ ...ch, [i]: c }))}
            onStepPrompt={messaging.sendStepPrompt}
            messageBlocks={messageBlocks}
            codebases={[]}
            onCodebasesUpdate={() => {}}
            onApplyAll={applyAllBlocks}
            fileTargetedCount={fileTargeted.length}
            onRunSandbox={runSandbox}
            onCloseRail={() => setRailSheetOpen(false)}
          />
        </div>
      </Sheet>

      {/* Properties drawer */}
      <CodePropertiesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversationId={sessions.conversationId}
        model={config.model}
        mode={config.mode}
        messages={messaging.messages}
        files={fileAttachment.files}
        renameTitle={sessions.renameTitle}
        onRenameTitle={sessions.setRenameTitle}
        renaming={sessions.renaming}
        renameError={sessions.renameError}
        onSaveRename={() => sessions.saveRename(sessions.conversationId!).catch(() => {})}
        onDeleteSession={() => sessions.deleteSession().catch(() => {})}
        ragEnabled={config.ragEnabled}
        knowledgeEnabled={config.knowledgeEnabled}
        searchEnabled={config.searchEnabled}
        useCodebase={config.useCodebase}
        codebaseCollection={config.codebaseCollection}
        createdAt={activeSession?.CreatedAt}
      />
    </div>
  );
}


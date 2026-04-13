import { useState, type DragEvent } from 'react';
import type { AttachedFile } from '../types/AttachedFile';
import { fileToBase64 } from '../utils/fileToBase64';
import { b64ToUtf8 } from '../utils/b64ToUtf8';
import { utf8ToB64 } from '../utils/utf8ToB64';

export interface FileAttachmentState {
  files: AttachedFile[];
  setFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  dragOver: boolean;
  setDragOver: React.Dispatch<React.SetStateAction<boolean>>;

  addFiles: (picked: File[]) => Promise<void>;
  removeFile: (name: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => Promise<void>;
}

export function useFileAttachment(): FileAttachmentState {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  async function addFiles(picked: File[]) {
    const encoded: AttachedFile[] = [];
    for (const f of picked) {
      try {
        const b64 = await fileToBase64(f);
        encoded.push({
          name: f.name,
          content_b64: b64,
          content: b64ToUtf8(b64),
          size: f.size,
        });
      } catch (err) {
        console.error('[code] file encode failed', f.name, err);
      }
    }
    setFiles((prev) => [
      ...prev.filter((p) => !encoded.find((e) => e.name === p.name)),
      ...encoded,
    ]);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0) await addFiles(dropped);
  }

  return {
    files,
    setFiles,
    dragOver,
    setDragOver,
    addFiles,
    removeFile,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}


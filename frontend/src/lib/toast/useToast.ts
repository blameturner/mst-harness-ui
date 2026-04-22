// frontend/src/lib/toast/useToast.ts
import { emitToast } from './ToastHost';

export function useToast() {
  return {
    info: (text: string) => emitToast(text, 'info'),
    success: (text: string) => emitToast(text, 'success'),
    error: (text: string) => emitToast(text, 'error'),
  };
}

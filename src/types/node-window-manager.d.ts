declare module 'node-window-manager' {
  export interface Window {
    id: number;
    processId?: number;
    getTitle(): string;
    isVisible(): boolean;
    bringToTop(): void;
  }

  export const windowManager: {
    getWindows(): Window[];
  };
}

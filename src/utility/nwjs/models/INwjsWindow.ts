export interface INwjsWindow {
  on(eventName: string, listener: (...args: any[]) => void): void;
  removeListener(eventName: string, listener: (...args: any[]) => void): void;
  hide(): void;
  close(force?: boolean): void;
}

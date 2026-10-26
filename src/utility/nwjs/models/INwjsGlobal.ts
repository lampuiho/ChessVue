import type { INwjsWindow } from './INwjsWindow';

export interface INwjsGlobal {
  App?: { quit(): void };
  Window: {
    get(windowObject?: Window): INwjsWindow;
  };
}

import type { INwjsWindow } from './INwjsWindow';

export interface INwjsGlobal {
  Window: {
    get(windowObject?: Window): INwjsWindow;
  };
}

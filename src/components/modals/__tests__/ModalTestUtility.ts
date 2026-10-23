import type { Plugin } from 'vue';
import { useModalProvider } from '@/composables/ModalComposable';
export const modalPlugin: Plugin = {
  install(app) {
    let initialised = false;
    // Initialise the real app owner on the test root before child setup runs.
    app.mixin({ beforeCreate() {
      if (initialised) return;
      initialised = true;
      useModalProvider();
    } });
  },
};

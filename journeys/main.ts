import '@/assets/main.css';
import { startJourney } from './StartJourney';

void startJourney(__CHESSVUE_JOURNEY_RUN__).catch((error) => {
  console.error('[journey] Startup failed.', error);
  const root = document.querySelector('#app');
  if (root) root.textContent = `Journey startup failed: ${error instanceof Error ? error.message : String(error)}`;
});

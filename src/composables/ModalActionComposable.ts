import { ref } from 'vue';
import { isPlatformError } from '@/utility/errors/StandardErrorHandlingUtility';
export function useModalAction(signal: AbortSignal) {
  const isWorking = ref(false);
  const errorMessage = ref('');
  async function run(action: () => Promise<unknown>) {
    if (isWorking.value || signal.aborted) return false;
    isWorking.value = true;
    errorMessage.value = '';
    try {
      await action();
      return !signal.aborted;
    } catch (error) {
      if (!signal.aborted) errorMessage.value = error instanceof Error || isPlatformError(error) ? error.message : 'The action could not be completed.';
      return false;
    } finally { isWorking.value = false; }
  }
  return { isWorking, errorMessage, run };
}

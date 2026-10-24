import type { IProcess } from '@/contracts/platform';
import { UciEngineClientBase } from '@/platform/base/UciEngineClientBase';
import { isProcessOpen, type ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

export class NwjsUciEngineClient extends UciEngineClientBase {
  protected override _isProcessOpen(process: IProcess) {
    return isProcessOpen(process as ISpawnedProcess);
  }
  protected override _getProcessExitDetail(process: IProcess) {
    const nativeProcess = process as ISpawnedProcess;
    return `code=${nativeProcess.exitCode ?? 'null'} signal=${nativeProcess.signalCode ?? 'null'}`;
  }
}

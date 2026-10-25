import type { IProcess } from '@/contracts/platform';
import { EngineClientType } from '@/contracts/Engine';
import { BrowserWorkerProcess } from '@/utility/BrowserWorkerProcess';
import { UciEngineClientBase } from '@/platform/base/UciEngineClientBase';

export class BrowserUciEngineClient extends UciEngineClientBase {
  constructor() { super(EngineClientType.UciWorker); }
  protected override _isProcessOpen(process: IProcess) {
    return process instanceof BrowserWorkerProcess && !process.closed;
  }
  protected override _getProcessExitDetail(process: IProcess) {
    return (process as BrowserWorkerProcess).exitDetail;
  }
}

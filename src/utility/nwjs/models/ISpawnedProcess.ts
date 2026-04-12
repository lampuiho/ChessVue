export interface ISpawnedProcess {
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  once(eventName: string, listener: (...args: any[]) => void): this;
  on(eventName: string, listener: (...args: any[]) => void): this;
  removeListener(eventName: string, listener: (...args: any[]) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
}

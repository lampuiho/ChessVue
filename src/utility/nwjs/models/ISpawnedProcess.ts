export interface ISpawnedProcess {
  stdin?: NodeJS.WritableStream;
  stdout?: NodeJS.ReadableStream;
  stderr?: NodeJS.ReadableStream;
  once(eventName: string, listener: (...args: any[]) => void): this;
  on(eventName: string, listener: (...args: any[]) => void): this;
  removeListener(eventName: string, listener: (...args: any[]) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
}

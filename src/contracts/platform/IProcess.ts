export interface IProcessInput {
  write(chunk: string): boolean;
}
export interface IProcessOutput {
  on(event: 'data', listener: (chunk: string) => void): unknown;
  removeListener(event: 'data', listener: (chunk: string) => void): unknown;
}
export interface IProcess {
  readonly stdin?: IProcessInput;
  readonly stdout?: IProcessOutput;
  readonly stderr?: IProcessOutput;
  once(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  removeListener(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  kill(): boolean;
}

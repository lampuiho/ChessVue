import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
export function requireExecutable(value: string | undefined, name: string): Promise<string>;
export function availablePort(): Promise<number>;
export function launchDesktop(options: { executable: string; directory: string; url: string; port: number; visible?: boolean; deferNavigation?: boolean }): Promise<ChildProcessByStdio<null, Readable, Readable>>;
export function terminateDesktop(child: import('node:child_process').ChildProcess): Promise<void>;

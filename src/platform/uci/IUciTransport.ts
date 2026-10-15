/** Private transport seam shared by desktop process I/O and browser workers. */
export interface IUciTransport {
  write(command: string): Promise<void> | void;
  subscribe(onLine: (line: string) => void, onExit: (detail?: string) => void): () => void;
}

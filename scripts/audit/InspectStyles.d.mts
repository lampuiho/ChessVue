interface IStyleFinding { kind: 'style'; key: string; file: string; line: number; message: string }
export function inspectStyles(file: string, raw: string): IStyleFinding[];

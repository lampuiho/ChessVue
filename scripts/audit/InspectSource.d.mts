export interface ICodeFinding {
  kind: string;
  key: string;
  file: string;
  line: number;
  message: string;
}
export function inspectSource(file: string, raw: string): ICodeFinding[];

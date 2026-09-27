/** One garbage color per colored match-4+ run (live `type:"attack"` `colors`). */
export function noteClearRun(colors: number[], runLength: number, runColor: number): void {
  if (runLength >= 4 && Number.isInteger(runColor) && runColor >= 0 && runColor <= 3) {
    colors.push(runColor);
  }
}

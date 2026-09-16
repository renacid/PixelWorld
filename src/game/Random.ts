/** シード付き乱数。Math.randomをゲームルール内で使わず、再開・リプレイを再現します。 */
export class Random {
  constructor(public seed: number) { this.seed = seed >>> 0; }
  next(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
}

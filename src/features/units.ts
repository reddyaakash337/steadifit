export type WeightUnit = 'kg' | 'lb';

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (!Number.isFinite(value) || from === to) return Number.isFinite(value) ? value : 0;
  return from === 'kg' ? value * 2.2046226218 : value / 2.2046226218;
}

export function formatWeight(value: number, from: WeightUnit, to: WeightUnit, precision = 1): string {
  const converted = convertWeight(value, from, to);
  return converted.toFixed(precision).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

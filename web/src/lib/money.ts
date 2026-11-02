export const rupeesToPaise = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const paiseToRupees = (v: unknown) =>
  Number((Number(v || 0) / 100).toFixed(2));

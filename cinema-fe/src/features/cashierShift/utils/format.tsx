export function money(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString()}đ`;
}

export function DifferenceValue({ value }: { value: number | null }) {
  if (value === null) return <span>—</span>;
  const className = value === 0 ? 'text-txt' : value > 0 ? 'text-emerald-400' : 'text-red-400';
  const sign = value > 0 ? '+' : '';
  return <span className={className}>{`${sign}${value.toLocaleString()}đ`}</span>;
}

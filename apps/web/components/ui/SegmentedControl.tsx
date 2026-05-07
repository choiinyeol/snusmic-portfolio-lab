'use client';

type Option = {
  id: string;
  label: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`segmented-control ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={value === option.id ? 'active' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { formatNativeWithKrw } from '@/lib/format';

export function Price({
  native,
  krw,
  currency,
  secondary = true,
}: {
  native: number | null | undefined;
  krw?: number | null | undefined;
  currency: string | null | undefined;
  secondary?: boolean;
}) {
  const { primary, secondary: secondaryText } = formatNativeWithKrw(native, krw, currency);
  return (
    <>
      {primary}
      {secondary && secondaryText ? <div className="native-price-secondary">{secondaryText}</div> : null}
    </>
  );
}

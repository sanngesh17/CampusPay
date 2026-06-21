export const CURRENCIES = ['INR', 'GBP', 'USD'] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

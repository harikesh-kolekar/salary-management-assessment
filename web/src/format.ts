export function formatCurrency(value: number | null | undefined, currency: string) {
  if (value == null) return "—";
  try {
    const locale: Record<string, string> = { USD: "en-US", GBP: "en-GB", INR: "en-IN", EUR: "de-DE", CAD: "en-CA", AUD: "en-AU", SGD: "en-SG", JPY: "ja-JP" };
    return new Intl.NumberFormat(locale[currency] ?? "en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)}`;
  }
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

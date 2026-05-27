const CURRENCY_KEY = "preferredCurrency";

export function getPreferredCurrency(): string {
  if (typeof window === "undefined") return "INR";
  return localStorage.getItem(CURRENCY_KEY) || "INR";
}

export function setPreferredCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENCY_KEY, currency);
}

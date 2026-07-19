export type AdProvider = "house";

export function getAdProvider(value: string | undefined): AdProvider {
  return value?.trim().toLowerCase() === "house" ? "house" : "house";
}

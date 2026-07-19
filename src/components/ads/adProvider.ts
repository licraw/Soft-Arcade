export type AdProvider = "house";

export function getAdProvider(value: string | undefined): AdProvider {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "house") {
    return normalizedValue;
  }

  return "house";
}

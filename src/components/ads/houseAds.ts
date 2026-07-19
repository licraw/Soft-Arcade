export type HouseAdDefinition = {
  advertiserId: string;
  siteName: string;
  destinationUrl: string;
  imagePath: string;
  imageAlt: string;
  headline: string;
  description: string;
  cta: string;
  selectionWeight: number;
};

export const HOUSE_ADS = [
  {
    advertiserId: "upper-left-indie",
    siteName: "Upper Left Indie",
    destinationUrl: "https://upperleftindie.com",
    imagePath: "/house-ads/upper-left-indie-logo.jpg",
    imageAlt: "Upper Left Indie mountain artwork",
    headline: "Hear the Northwest’s indie side",
    description: "Discover under-heard independent artists from across the Pacific Northwest.",
    cta: "Listen now",
    selectionWeight: 1
  },
  {
    advertiserId: "ne-portland-painters",
    siteName: "NE Portland Painters",
    destinationUrl: "https://neportlandpainters.com",
    imagePath: "/house-ads/ne-portland-painters-logo.png",
    imageAlt: "NE Portland Painters logo",
    headline: "Your neighborhood painting team",
    description: "Interior, exterior, carpentry, and more for homes around Portland.",
    cta: "Get an estimate",
    selectionWeight: 1
  },
  {
    advertiserId: "clean-strength",
    siteName: "Clean Strength",
    destinationUrl: "https://cleanstrength.com",
    imagePath: "/house-ads/clean-strength-logo.png",
    imageAlt: "Clean Strength logo",
    headline: "Clean strength, clear purpose",
    description: "Shop American-made supplements that support strength, wellness, and clean water.",
    cta: "Shop supplements",
    selectionWeight: 1
  }
] as const satisfies readonly HouseAdDefinition[];

export function selectHouseAd(randomValue = Math.random()): HouseAdDefinition {
  const normalizedRandomValue = Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON);
  const totalWeight = HOUSE_ADS.reduce((total, ad) => total + ad.selectionWeight, 0);
  let selectionPoint = normalizedRandomValue * totalWeight;

  for (const ad of HOUSE_ADS) {
    selectionPoint -= ad.selectionWeight;
    if (selectionPoint < 0) {
      return ad;
    }
  }

  return HOUSE_ADS[HOUSE_ADS.length - 1];
}

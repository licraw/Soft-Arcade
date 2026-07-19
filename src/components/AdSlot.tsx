import { getAdProvider } from "./ads/adProvider";
import { HouseAd } from "./ads/HouseAd";

export const GAME_PAGE_DESKTOP_AD_PLACEMENT_ID = "game-page-desktop";

type AdSlotProps = {
  placementId?: string;
};

export function AdSlot({ placementId = GAME_PAGE_DESKTOP_AD_PLACEMENT_ID }: AdSlotProps) {
  const provider = getAdProvider(process.env.NEXT_PUBLIC_AD_PROVIDER);

  return (
    <aside className="ad-slot" aria-label="Advertisement">
      {provider === "house" ? <HouseAd placementId={placementId} /> : null}
    </aside>
  );
}

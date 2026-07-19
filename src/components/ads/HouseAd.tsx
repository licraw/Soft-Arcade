"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { selectHouseAd, type HouseAdDefinition } from "./houseAds";

type HouseAdProps = {
  placementId: string;
};

export function HouseAd({ placementId }: HouseAdProps) {
  const [ad, setAd] = useState<HouseAdDefinition | null>(null);
  const hasSelectedAd = useRef(false);

  useEffect(() => {
    if (hasSelectedAd.current) {
      return;
    }

    hasSelectedAd.current = true;
    setAd(selectHouseAd());
  }, []);

  if (!ad) {
    return <div className="house-ad-placeholder" aria-hidden="true" />;
  }

  return (
    <a
      className="house-ad"
      href={ad.destinationUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit ${ad.siteName} (opens in a new tab)`}
      data-advertiser-id={ad.advertiserId}
      data-placement-id={placementId}
    >
      <span className="house-ad-label">Advertisement</span>
      <span className="house-ad-logo-frame">
        <Image
          className="house-ad-logo"
          src={ad.imagePath}
          alt={ad.imageAlt}
          fill
          sizes="240px"
        />
      </span>
      <span className="house-ad-copy">
        <strong>{ad.headline}</strong>
        <span>{ad.description}</span>
      </span>
      <span className="house-ad-cta" aria-hidden="true">
        {ad.cta}
      </span>
    </a>
  );
}

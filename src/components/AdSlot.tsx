type AdSlotProps = {
  label?: string;
};

export function AdSlot({ label = "Ad space" }: AdSlotProps) {
  return (
    <aside className="ad-slot" aria-label={label}>
      <span>{label}</span>
    </aside>
  );
}

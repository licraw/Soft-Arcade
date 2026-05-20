type AdSlotProps = {
  label?: "Advertisement" | "Sponsored";
};

export function AdSlot({ label = "Advertisement" }: AdSlotProps) {
  return (
    <aside className="ad-slot" aria-label={label}>
      <span>{label}</span>
    </aside>
  );
}

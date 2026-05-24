type ScorePillProps = {
  label: string;
  value: string | number;
  tone?: "cyan" | "gold" | "pink" | "green";
};

export function ScorePill({ label, value, tone = "cyan" }: ScorePillProps) {
  return (
    <div className={`car-score-pill car-score-pill-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

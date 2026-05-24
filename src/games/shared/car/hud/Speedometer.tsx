type SpeedometerProps = {
  speed: number;
};

export function Speedometer({ speed }: SpeedometerProps) {
  return (
    <div className="car-speedometer" aria-label={`Speed ${Math.round(speed)} miles per hour`}>
      <span>Speed</span>
      <strong>{Math.round(speed)}</strong>
      <small>mph</small>
    </div>
  );
}

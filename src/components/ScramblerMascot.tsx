type ScramblerMascotProps = {
  className?: string;
  title?: string;
};

export function ScramblerMascot({ className = "", title = "The Scrambler mascot" }: ScramblerMascotProps) {
  return (
    <svg className={`scrambler-mascot ${className}`.trim()} viewBox="-28 0 176 120" role="img" aria-label={title}>
      <g className="scrambler-arms">
        <g className="scrambler-arm scrambler-arm-left">
          <path className="scrambler-limb" d="M29 59 C14 58, -6 68, -8 88 C-10 101, 4 108, 26 97"></path>
          <path className="scrambler-hand" d="M20 96 L5 104 M20 93 L0 93 M21 90 L6 82"></path>
        </g>
        <g className="scrambler-arm scrambler-arm-right">
          <path className="scrambler-limb" d="M91 59 C106 58, 126 68, 128 88 C130 101, 116 108, 94 97"></path>
          <path className="scrambler-hand" d="M100 96 L115 104 M100 93 L120 93 M99 90 L114 82"></path>
        </g>
      </g>
      <line className="scrambler-horn" x1="41" y1="22" x2="34" y2="12"></line>
      <line className="scrambler-horn" x1="79" y1="22" x2="86" y2="12"></line>
      <line className="scrambler-glitch-bar" x1="15" y1="42" x2="29" y2="42"></line>
      <line className="scrambler-glitch-bar is-magenta" x1="89" y1="34" x2="104" y2="34"></line>
      <line className="scrambler-glitch-bar" x1="92" y1="76" x2="107" y2="76"></line>
      <line className="scrambler-glitch-bar is-magenta" x1="19" y1="84" x2="33" y2="84"></line>
      <path className="scrambler-face" d="M60 16 L92 34 L102 60 L92 88 L60 104 L28 88 L18 60 L28 34 Z"></path>
      <path className="scrambler-brow" d="M34 44 L53 39"></path>
      <path className="scrambler-brow" d="M86 44 L67 39"></path>
      <path className="scrambler-eye" d="M38 53 L52 47 L49 61 L34 62 Z"></path>
      <path className="scrambler-eye" d="M82 51 L68 47 L71 60 L86 60 Z"></path>
      <circle className="scrambler-pupil" cx="46" cy="55" r="2.4"></circle>
      <circle className="scrambler-pupil" cx="75" cy="54" r="2.1"></circle>
      <path className="scrambler-mouth" d="M42 75 C48 72, 52 81, 58 78 C65 74, 68 85, 78 72"></path>
      <path className="scrambler-mouth-accent" d="M44 80 L50 78"></path>
    </svg>
  );
}

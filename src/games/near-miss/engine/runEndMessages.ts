export const RUN_END_MESSAGES = [
  "Flow Broken",
  "Gap Closed",
  "Lost the Line",
  "Too Tight",
  "Traffic Wins",
  "No Way Through",
  "Momentum Lost",
  "Lane Lost",
  "Ride Over",
  "Too Late",
  "Missed the Opening",
  "Line Cut",
  "Gap Vanished",
  "Flow Interrupted"
];

export function chooseRunEndMessage(previousMessage?: string) {
  if (RUN_END_MESSAGES.length <= 1) {
    return RUN_END_MESSAGES[0] || "Run Over";
  }

  let message = RUN_END_MESSAGES[Math.floor(Math.random() * RUN_END_MESSAGES.length)];

  if (message === previousMessage) {
    const fallbackIndex = (RUN_END_MESSAGES.indexOf(message) + 1) % RUN_END_MESSAGES.length;
    message = RUN_END_MESSAGES[fallbackIndex];
  }

  return message;
}

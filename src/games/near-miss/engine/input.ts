export type NearMissInputState = {
  steer: -1 | 0 | 1;
  throttle: boolean;
  brake: boolean;
};

type InputHandler = (input: NearMissInputState) => void;

const inputState: NearMissInputState = {
  steer: 0,
  throttle: false,
  brake: false
};

const heldKeys = new Set<string>();

export function createInputController(target: HTMLElement, onInput: InputHandler) {
  const syncKeyboardInput = () => {
    const left = heldKeys.has("arrowleft") || heldKeys.has("a");
    const right = heldKeys.has("arrowright") || heldKeys.has("d");

    inputState.steer = left && !right ? -1 : right && !left ? 1 : 0;
    inputState.throttle = heldKeys.has("arrowup") || heldKeys.has("w");
    inputState.brake = heldKeys.has("arrowdown") || heldKeys.has("s");
    onInput({ ...inputState });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
      event.preventDefault();
      heldKeys.add(key);
      syncKeyboardInput();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (heldKeys.has(key)) {
      event.preventDefault();
      heldKeys.delete(key);
      syncKeyboardInput();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, a")) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    inputState.steer = event.clientX - bounds.left < bounds.width / 2 ? -1 : 1;

    event.preventDefault();
    onInput({ ...inputState });
  };

  const onPointerUp = () => {
    inputState.steer = 0;
    onInput({ ...inputState });
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onPointerUp);
  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointerup", onPointerUp);
  target.addEventListener("pointercancel", onPointerUp);
  target.addEventListener("pointerleave", onPointerUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onPointerUp);
    target.removeEventListener("pointerdown", onPointerDown);
    target.removeEventListener("pointerup", onPointerUp);
    target.removeEventListener("pointercancel", onPointerUp);
    target.removeEventListener("pointerleave", onPointerUp);
    heldKeys.clear();
    inputState.steer = 0;
    inputState.throttle = false;
    inputState.brake = false;
  };
}

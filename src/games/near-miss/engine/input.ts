export type NearMissInputState = {
  steer: -1 | 0 | 1;
  throttle: boolean;
  brake: boolean;
};

type InputHandler = (input: NearMissInputState) => void;

export type NearMissControl = "left" | "right" | "throttle" | "brake";

export type NearMissInputController = {
  setControl: (control: NearMissControl, active: boolean) => void;
  cleanup: () => void;
};

export function createInputController(onInput: InputHandler): NearMissInputController {
  const inputState: NearMissInputState = {
    steer: 0,
    throttle: false,
    brake: false
  };
  const heldKeys = new Set<string>();
  const heldControls = new Set<NearMissControl>();

  const syncInput = () => {
    const left = heldKeys.has("arrowleft") || heldKeys.has("a") || heldControls.has("left");
    const right = heldKeys.has("arrowright") || heldKeys.has("d") || heldControls.has("right");

    inputState.steer = left && !right ? -1 : right && !left ? 1 : 0;
    inputState.throttle = heldKeys.has("arrowup") || heldKeys.has("w") || heldControls.has("throttle");
    inputState.brake = heldKeys.has("arrowdown") || heldKeys.has("s") || heldControls.has("brake");
    onInput({ ...inputState });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
      event.preventDefault();
      heldKeys.add(key);
      syncInput();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (heldKeys.has(key)) {
      event.preventDefault();
      heldKeys.delete(key);
      syncInput();
    }
  };

  const clearPointerInput = () => {
    heldControls.clear();
    syncInput();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearPointerInput);

  return {
    setControl: (control, active) => {
      if (active) {
        heldControls.add(control);
      } else {
        heldControls.delete(control);
      }
      syncInput();
    },
    cleanup: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearPointerInput);
      heldKeys.clear();
      heldControls.clear();
      inputState.steer = 0;
      inputState.throttle = false;
      inputState.brake = false;
    }
  };
}

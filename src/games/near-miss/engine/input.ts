export type NearMissInputState = {
  steer: -1 | 0 | 1;
  throttle: boolean;
  brake: boolean;
};

type InputHandler = (input: NearMissInputState) => void;

export type NearMissControl = "left" | "right" | "throttle" | "brake";

export type NearMissInputController = {
  pressControl: (control: NearMissControl, pointerId: number) => void;
  releaseControl: (control: NearMissControl, pointerId: number) => void;
  clearAllInputs: () => void;
  cleanup: () => void;
};

const exclusiveControls: Partial<Record<NearMissControl, NearMissControl>> = {
  left: "right",
  right: "left",
  throttle: "brake",
  brake: "throttle"
};

export function createInputController(onInput: InputHandler): NearMissInputController {
  const inputState: NearMissInputState = {
    steer: 0,
    throttle: false,
    brake: false
  };
  const heldKeys = new Set<string>();
  const controlPointers = new Map<NearMissControl, number>();

  const syncInput = () => {
    const controlLeft = controlPointers.has("left");
    const controlRight = controlPointers.has("right");
    const keyLeft = heldKeys.has("arrowleft") || heldKeys.has("a");
    const keyRight = heldKeys.has("arrowright") || heldKeys.has("d");
    const left = controlLeft || (!controlRight && keyLeft);
    const right = controlRight || (!controlLeft && keyRight);
    const controlThrottle = controlPointers.has("throttle");
    const controlBrake = controlPointers.has("brake");

    inputState.steer = left && !right ? -1 : right && !left ? 1 : 0;
    inputState.throttle = controlThrottle || (!controlBrake && (heldKeys.has("arrowup") || heldKeys.has("w")));
    inputState.brake = controlBrake || (!controlThrottle && (heldKeys.has("arrowdown") || heldKeys.has("s")));
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

  const clearAllInputs = () => {
    heldKeys.clear();
    controlPointers.clear();
    syncInput();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearAllInputs);

  return {
    pressControl: (control, pointerId) => {
      const exclusiveControl = exclusiveControls[control];

      if (exclusiveControl) {
        controlPointers.delete(exclusiveControl);
      }
      controlPointers.set(control, pointerId);
      syncInput();
    },
    releaseControl: (control, pointerId) => {
      if (controlPointers.get(control) !== pointerId) {
        return;
      }
      controlPointers.delete(control);
      syncInput();
    },
    clearAllInputs,
    cleanup: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAllInputs);
      heldKeys.clear();
      controlPointers.clear();
      inputState.steer = 0;
      inputState.throttle = false;
      inputState.brake = false;
    }
  };
}

import type { PressableStateCallbackType } from "react-native";

/** react-native-web also reports hover/focus to Pressable style/children callbacks. */
export type WebPressState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

export function pressState(state: PressableStateCallbackType): WebPressState {
  return state as WebPressState;
}

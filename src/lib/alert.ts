// Drop-in replacement for React Native's Alert, rendered as an in-app dialog.
// AlertProvider registers the renderer at startup.
export type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type Handler = (title: string, message?: string, buttons?: AlertButton[]) => void;

let handler: Handler | null = null;

export function setAlertHandler(h: Handler | null) {
  handler = h;
}

export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (handler) handler(title, message, buttons);
    else console.log(title, message ?? '');
  },
};

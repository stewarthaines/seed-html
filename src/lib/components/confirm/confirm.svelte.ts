/**
 * An in-page replacement for `window.confirm()`.
 *
 * The native dialog blocks the page's event loop until it is answered, which
 * stalls anything driving the app (browser agents stop responding until a
 * person dismisses it) and cannot be styled, translated button by button, or
 * reached through the accessibility tree like the rest of the UI. A caller
 * awaits `confirmDialog()` instead; `ConfirmDialog.svelte`, mounted once in
 * App, renders whichever request is pending.
 */

export interface ConfirmRequest {
  /** The question, shown as the dialog's text and its accessible name. */
  message: string;
  /** Label of the button that answers yes. */
  confirmLabel: string;
  /** Label of the button that answers no; the shared "Cancel" when omitted. */
  cancelLabel?: string;
  /** Style the yes button as destructive. */
  danger?: boolean;
}

interface Pending extends ConfirmRequest {
  resolve: (answer: boolean) => void;
}

const queue = $state<Pending[]>([]);

/** The request on screen now, or null. Read by ConfirmDialog. */
export function currentConfirm(): Pending | null {
  return queue[0] ?? null;
}

/**
 * Ask a yes/no question in the page. Resolves true for the confirm button,
 * false for the cancel button, Escape or a click outside. Requests made while
 * one is open wait their turn.
 */
export function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({ ...request, resolve });
  });
}

/** Answer the request on screen and show the next one, if any. */
export function answerConfirm(answer: boolean): void {
  const pending = queue.shift();
  pending?.resolve(answer);
}

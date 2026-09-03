// Shared chat event name. Kept in its own module so that lightweight consumers
// (e.g. UserGuide) can reference the event without statically importing the
// heavy ChatWidget component, which would pull it out of its lazy chunk.
export const OPEN_CHAT_EVENT = "lalum:open-chat";

// Fired by the chat whenever it opens or closes, with `detail.open` carrying the
// new state. Other floating controls (the video bubble) listen so that only one
// panel ever occupies the corner: two overlapping dialogs in the same 24px
// corner is the one arrangement that always looks broken.
export const CHAT_STATE_EVENT = "lalum:chat-state";

export function emitChatState(open: boolean) {
  window.dispatchEvent(new CustomEvent(CHAT_STATE_EVENT, { detail: { open } }));
}

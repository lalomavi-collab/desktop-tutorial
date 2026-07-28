// Shared chat event name. Kept in its own module so that lightweight consumers
// (e.g. UserGuide) can reference the event without statically importing the
// heavy ChatWidget component, which would pull it out of its lazy chunk.
export const OPEN_CHAT_EVENT = "lalum:open-chat";

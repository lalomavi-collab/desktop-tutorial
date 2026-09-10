// Shared event so the quick-access dot can open the video panel without
// importing VideoBubble's (lazy-loaded, stateful) module directly — the same
// pattern chatEvents.ts already uses for the chat widget.
export const OPEN_VIDEO_EVENT = "lalum:open-video";

export function emitOpenVideo(trigger?: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent(OPEN_VIDEO_EVENT, { detail: { trigger } }));
}

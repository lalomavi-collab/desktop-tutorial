// Where a marketing invitation (the intro video, the quick-access dot itself)
// would interrupt rather than invite: the sign-in form and the private client
// area, which people reach with a task already in mind. Shared by
// QuickAccessDot (which hides entirely here) and VideoBubble (which refuses
// to open even if asked, in case a request is in flight while navigating).
export const QUIET_ROUTES = /^\/(login|portal)(\/|$)/;

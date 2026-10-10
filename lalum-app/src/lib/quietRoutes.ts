// Where a marketing invitation would interrupt rather than invite: the sign-in
// form and the private client area, which people reach with a task already in
// mind. QuickAccessDot hides entirely on these routes, which is what takes the
// intro film and the readiness check off them too, since its menu is the only
// way into either.
export const QUIET_ROUTES = /^\/(login|portal)(\/|$)/;

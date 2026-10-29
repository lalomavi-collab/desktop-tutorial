// The colours the finance dashboard's charts share (FinCharts, BankDashboardTab): money in, money out, and the ledger's own
// green, all theme tokens so the light and the dark cockpit both hold.
export const IN = "var(--fin-inflow)", OUT = "var(--fin-outflow)", OK = "var(--chart-ok, #216f33)";
/** A quieter step of a series colour, for the marks around the one the tile is about (emphasis, not a second hue). */
export const quiet = (c: string) => `color-mix(in srgb, ${c} 34%, var(--card-solid, #fff))`;

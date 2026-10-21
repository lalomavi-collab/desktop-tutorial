import { CockpitFrame } from "./CockpitFrame";
import { SchedulingConsole } from "../../components/SchedulingConsole";

// The firm's scheduling console lives in the cockpit, not the client portal:
// it plans the firm's own week (events, free slots, placing tasks), which is
// management work. The portal stays the client area. The console component is
// unchanged; this page only frames it for the cockpit.

/** Firm scheduling console, framed for the cockpit. */
export function Scheduling() {
  return (
    <CockpitFrame title="יומן ופגישות" description="תכנון שבוע העבודה של הפירמה: אירועים, זמנים פנויים ושיבוץ משימות." path="/workspace/scheduling">
      {() => <SchedulingConsole />}
    </CockpitFrame>
  );
}

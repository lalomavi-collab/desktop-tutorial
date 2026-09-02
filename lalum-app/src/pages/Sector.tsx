import { useParams } from "react-router-dom";
import { SectorView } from "../components/SectorView";
import { NotFound } from "./NotFound";
import { sectorBySlug } from "../lib/sectors";

// One page for every sector rubric under the AI pillar. The slug is resolved
// against SECTORS, so a new rubric is an entry in sectors.ts and needs no
// route of its own. An unknown slug falls through to the 404 rather than
// rendering an empty shell.
export function Sector() {
  const { sector } = useParams();
  const S = sector ? sectorBySlug(sector) : undefined;
  if (!S) return <NotFound />;
  return <SectorView S={S} />;
}

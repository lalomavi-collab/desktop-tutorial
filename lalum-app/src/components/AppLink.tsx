import { Link as RRLink, NavLink as RRNavLink, type LinkProps, type NavLinkProps } from "react-router-dom";

// Internal links must point at the final, trailing-slash URL that the host
// serves with a 200. Content routes render at "<path>/" (the host adds the
// trailing slash and 308-redirects the no-slash form), and canonical, hreflang
// and the sitemap already use the slash form. Without this, every internal link
// sent the crawler through a 308 and burned crawl budget. React Router matches
// the slash form to the same route, so client navigation is unaffected.
//
// External links, mailto/tel, pure hash and query-only targets, the home path,
// and file-like paths are returned unchanged.
function slashify(to: string): string {
  if (/^(https?:|mailto:|tel:|\/\/)/i.test(to)) return to;
  const hashIdx = to.indexOf("#");
  const hash = hashIdx >= 0 ? to.slice(hashIdx) : "";
  const beforeHash = hashIdx >= 0 ? to.slice(0, hashIdx) : to;
  const qIdx = beforeHash.indexOf("?");
  const query = qIdx >= 0 ? beforeHash.slice(qIdx) : "";
  let path = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  if (path === "" || path === "/") return to; // pure hash/query, or home
  if (/\.[a-z0-9]+$/i.test(path)) return to; // looks like a file
  if (!path.endsWith("/")) path += "/";
  return path + query + hash;
}

function norm(to: LinkProps["to"]): LinkProps["to"] {
  return typeof to === "string" ? slashify(to) : to;
}

export function Link({ to, ...rest }: LinkProps) {
  return <RRLink to={norm(to)} {...rest} />;
}

export function NavLink({ to, ...rest }: NavLinkProps) {
  return <RRNavLink to={norm(to)} {...rest} />;
}

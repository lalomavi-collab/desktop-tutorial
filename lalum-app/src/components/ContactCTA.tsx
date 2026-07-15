import { contactEmail } from "../lib/content";

type Props = {
  title: string;
  body: string;
  primaryLabel?: string;
  email?: string;
};

export function ContactCTA({ title, body, primaryLabel = "Initiate a risk assessment", email = contactEmail }: Props) {
  return (
    <section className="wrap" style={{ paddingBottom: "var(--sec)" }}>
      <div className="panel-dark">
        <div className="glow" />
        <h2
          className="serif"
          style={{ position: "relative", fontSize: 46, lineHeight: 1.12, letterSpacing: "-0.015em", color: "var(--paper)", margin: "0 0 18px" }}
        >
          {title}
        </h2>
        <p style={{ position: "relative", fontSize: 18, lineHeight: 1.65, color: "#D8D2C7", maxWidth: "52ch", margin: "0 auto 32px" }}>
          {body}
        </p>
        <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`mailto:${email}`} className="btn btn-clay">{primaryLabel}</a>
          <a href={`mailto:${email}`} style={{ color: "#E4C7B7", fontSize: 15 }} dir="ltr">{email}</a>
        </div>
      </div>
    </section>
  );
}

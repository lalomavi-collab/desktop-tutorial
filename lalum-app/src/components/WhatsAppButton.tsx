import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { whatsappNumber } from "../lib/content";

// Floating WhatsApp button for quick, direct chat with the firm's business line.
// Sits just above the LEX chat bubble at the bottom of the screen.
export function WhatsAppButton() {
  const { t } = useLang();
  const w = t.ui.whatsapp;
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(w.msg)}`;

  return (
    <a
      className="wa-fab"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={w.aria}
      title={w.aria}
    >
      <Icon name="whatsapp" size={32} />
    </a>
  );
}

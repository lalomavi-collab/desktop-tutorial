import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { telegramUrl } from "../lib/content";

// Floating Telegram button for quick contact, stacked above the WhatsApp button.
export function TelegramButton() {
  const t = useLang().t.ui.telegram;
  return (
    <a
      className="tg-fab"
      href={telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.aria}
      title={t.aria}
    >
      <Icon name="telegram" size={30} />
    </a>
  );
}

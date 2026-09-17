import { BRAND } from "../lib/content";
import ApplicationForm from "./ApplicationForm";
import Reveal from "./Reveal";

export default function Apply() {
  return (
    <section id="apply" className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-ink">Build your practice around intelligence.</h2>
          <p className="mt-5 text-muted max-w-xl mx-auto">
            {BRAND.name} is selecting experienced practitioners to lead specialized domains within the platform.
          </p>
        </Reveal>

        <div className="mt-12">
          <ApplicationForm />
        </div>
      </div>
    </section>
  );
}

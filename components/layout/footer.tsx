import Link from "next/link";
import { ShieldCheck, Heart, Fuel } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] bg-[var(--surface)] mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground font-heading font-black text-sm">
                RM
              </div>
              <span className="font-heading font-bold text-base text-foreground">Real Miles</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Real vehicle owner insights for younger Indian buyers. No sponsored fluff, no dealership marketing.
              Every review is structured from actual verified ownership experiences.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span>Odometer verified ownership records</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3 font-heading">
              Launch Vehicles
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link href="/vehicles/mahindra-thar" className="hover:text-foreground">Mahindra Thar</Link></li>
              <li><Link href="/vehicles/tata-harrier" className="hover:text-foreground">Tata Harrier</Link></li>
              <li><Link href="/vehicles/hyundai-creta" className="hover:text-foreground">Hyundai Creta</Link></li>
              <li><Link href="/vehicles/bmw-330li" className="hover:text-foreground">BMW 330Li</Link></li>
              <li><Link href="/vehicles/ktm-390-adventure-s" className="hover:text-foreground">KTM 390 Adventure S</Link></li>
              <li><Link href="/vehicles/re-himalayan-450" className="hover:text-foreground">Royal Enfield Himalayan 450</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3 font-heading">
              Community & System
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link href="/reviews/new" className="hover:text-foreground">Submit a Review</Link></li>
              <li><Link href="/auth/login" className="hover:text-foreground">Owner Login</Link></li>
              <li><Link href="/api/health" className="hover:text-foreground">System Health (/api/health)</Link></li>
              <li><span className="text-muted-foreground/60">English with Hindi & Hinglish support</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--surface-border)] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} Real Miles. Free tier, open community architecture.</p>
          <p className="flex items-center gap-1">
            Built with Next.js 14, Supabase & Gemini
          </p>
        </div>
      </div>
    </footer>
  );
}

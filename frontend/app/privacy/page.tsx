import Link from 'next/link';
import { SanaddsLogo } from '@/components/ui/Logo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — SpotFlow',
};

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-baseline gap-2.5">
        <span className="text-xs font-bold text-violet-400 tracking-widest uppercase opacity-70">{number}</span>
        {title}
      </h2>
      <div className="text-slate-400 leading-relaxed space-y-2 text-[0.9375rem]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-6 py-14">

        {/* Logo */}
        <div className="mb-12">
          <Link href="/login" aria-label="Back to SpotFlow">
            <SanaddsLogo size="md" />
          </Link>
        </div>

        {/* Title block */}
        <div className="mb-10 pb-8 border-b border-white/[0.07]">
          <p className="text-xs font-bold tracking-widest uppercase text-violet-400 mb-3">Legal</p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: June 24, 2026</p>
        </div>

        {/* Intro */}
        <p className="text-slate-400 leading-relaxed mb-10 text-[0.9375rem]">
          SpotFlow (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates{' '}
          <span className="text-slate-300">spotflow.pro</span>. This Privacy Policy explains what
          information we collect, how we use it, and your rights.
        </p>

        {/* Sections */}
        <Section number="01" title="Information We Collect">
          <ul className="space-y-1.5 list-none">
            {[
              ['Account info', 'email address, encrypted password'],
              ['Profile info', 'business name, phone number (optional), business description'],
              ['Connected accounts', 'when you connect Facebook, Instagram, or TikTok, we store encrypted access tokens (AES-256) to publish content on your behalf'],
              ['Usage data', 'campaigns created, posts generated, login activity'],
            ].map(([label, desc]) => (
              <li key={label} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />
                <span><span className="text-slate-300 font-medium">{label}:</span> {desc}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="02" title="How We Use Your Information">
          <ul className="space-y-1.5 list-none">
            {[
              ['Service delivery', 'generate ad strategies, create content, publish to your connected social media accounts'],
              ['Communication', 'account verification, service updates, promotional offers (you can opt out)'],
              ['Improvement', 'analyze usage patterns to improve the platform'],
            ].map(([label, desc]) => (
              <li key={label} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />
                <span><span className="text-slate-300 font-medium">{label}:</span> {desc}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="03" title="Data Sharing">
          <p>We do not sell your personal information. We share data only with:</p>
          <ul className="mt-2 space-y-1.5 list-none">
            {[
              'Meta (Facebook/Instagram) and TikTok, solely to publish content you authorize',
              'Service providers that help us operate (hosting, email delivery, AI content generation) under confidentiality agreements',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="04" title="Data Security">
          <p>
            All social media access tokens are encrypted using <span className="text-slate-300 font-medium">AES-256-GCM</span>.
            Passwords are hashed with <span className="text-slate-300 font-medium">bcrypt</span>.
            We use HTTPS for all data in transit.
          </p>
        </Section>

        <Section number="05" title="Your Rights">
          <p>
            You can request access to, correction of, or deletion of your personal data by
            contacting us at the email below. You can disconnect any social media account at any
            time from your dashboard.
          </p>
        </Section>

        <Section number="06" title="Data Retention">
          <p>
            We retain your account data while your account is active. Generated videos and images
            are automatically deleted after <span className="text-slate-300 font-medium">7 days</span>.
            You can request full account deletion at any time.
          </p>
        </Section>

        <Section number="07" title="Children&apos;s Privacy">
          <p>
            SpotFlow is not directed to individuals under 18. We do not knowingly collect data
            from minors.
          </p>
        </Section>

        <Section number="08" title="Changes to This Policy">
          <p>
            We may update this policy. We will notify users of material changes via email or
            in-app notice.
          </p>
        </Section>

        <Section number="09" title="Contact Us">
          <p>
            For privacy questions or data requests:{' '}
            <a
              href="mailto:contact@spotflow.pro"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              contact@spotflow.pro
            </a>
          </p>
        </Section>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <Link href="/login" className="hover:text-slate-300 transition-colors">
            ← Back to SpotFlow
          </Link>
          <Link href="/terms" className="hover:text-slate-300 transition-colors">
            Terms of Service →
          </Link>
        </div>

      </div>
    </div>
  );
}

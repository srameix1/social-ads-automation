import Link from 'next/link';
import { SanaddsLogo } from '@/components/ui/Logo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — SpotFlow',
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

export default function TermsPage() {
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
          <h1 className="text-3xl font-black text-white tracking-tight mb-3">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: June 24, 2026</p>
        </div>

        {/* Intro */}
        <p className="text-slate-400 leading-relaxed mb-10 text-[0.9375rem]">
          By using SpotFlow (<span className="text-slate-300">spotflow.pro</span>), you agree to
          these terms. Please read them carefully before creating an account or using the service.
        </p>

        {/* Sections */}
        <Section number="01" title="Service Description">
          <p>
            SpotFlow is an AI-powered social media advertising platform that helps businesses
            create and publish ad content to Facebook, Instagram, and TikTok.
          </p>
        </Section>

        <Section number="02" title="Account Responsibilities">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activity under your account. Notify us immediately of any unauthorized
            access at{' '}
            <a href="mailto:contact@spotflow.pro" className="text-violet-400 hover:text-violet-300 transition-colors">
              contact@spotflow.pro
            </a>.
          </p>
        </Section>

        <Section number="03" title="Acceptable Use">
          <p>You agree not to use SpotFlow to:</p>
          <ul className="mt-2 space-y-1.5 list-none">
            {[
              'Publish illegal, fraudulent, or misleading content',
              'Violate the terms of service of connected platforms (Meta, TikTok)',
              'Infringe on third-party intellectual property rights',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="04" title="Subscription and Billing">
          <p>
            Paid plans are billed according to the plan you select. You may cancel at any time;
            cancellation takes effect at the end of the current billing period. No refunds are
            issued for partial billing periods.
          </p>
        </Section>

        <Section number="05" title="Connected Accounts">
          <p>
            By connecting your Facebook, Instagram, or TikTok account, you authorize SpotFlow to
            publish content on your behalf according to your instructions within the platform. You
            can revoke this access at any time from your dashboard or directly from the connected
            platform&apos;s settings.
          </p>
        </Section>

        <Section number="06" title="Intellectual Property">
          <p>
            You retain ownership of content you upload. SpotFlow retains ownership of the
            platform, software, and AI-generated suggestions unless otherwise stated in writing.
          </p>
        </Section>

        <Section number="07" title="Limitation of Liability">
          <p>
            SpotFlow is provided &quot;as is.&quot; We are not liable for indirect, incidental,
            or consequential damages arising from use of the service, including but not limited to
            loss of revenue, data, or business opportunities.
          </p>
        </Section>

        <Section number="08" title="Termination">
          <p>
            We may suspend or terminate accounts that violate these terms or the policies of
            connected platforms. You may also terminate your account at any time by contacting
            support.
          </p>
        </Section>

        <Section number="09" title="Changes to Terms">
          <p>
            We may update these terms. Continued use of SpotFlow after changes constitutes
            acceptance of the updated terms. We will notify users of material changes via email.
          </p>
        </Section>

        <Section number="10" title="Contact">
          <p>
            Questions about these terms:{' '}
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
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">
            ← Privacy Policy
          </Link>
          <Link href="/login" className="hover:text-slate-300 transition-colors">
            Back to SpotFlow →
          </Link>
        </div>

      </div>
    </div>
  );
}

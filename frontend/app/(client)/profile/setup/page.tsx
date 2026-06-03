'use client';

import { useRouter } from 'next/navigation';
import { ProfileSetupForm } from '@/components/client/ProfileSetupForm';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      {/* Lang toggle top-right */}
      <div className="absolute top-5 right-6">
        <LanguageToggle />
      </div>
      <div className="relative w-full max-w-xl animate-slide-up">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <SanaddsLogo size="md" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('setup_title')}</h1>
          <p className="text-slate-500 text-sm mt-2">{t('setup_sub')}</p>
        </div>
        <div className="surface rounded-2xl p-8">
          <ProfileSetupForm onComplete={() => router.push('/dashboard')} />
        </div>
      </div>
    </div>
  );
}

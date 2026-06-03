'use client';

import { CampaignRequestForm } from '@/components/client/CampaignRequestForm';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NewCampaignPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t('new_camp_title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('new_camp_sub')}</p>
      </div>
      <div className="surface rounded-xl p-6">
        <CampaignRequestForm />
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, Loader2, Plus } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { createOrganization, fetchMyOrganizations } from '../features/tournaments/api';
import type { CreatableOrganizationKind, MyOrganization } from '../features/tournaments/domain';
import { membershipRoleLabel, organizationKindLabel } from '../features/tournaments/domain';

const inputClass = 'w-full rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors placeholder:text-[#71717a] focus:border-[#16a34a]';
const textareaClass = `${inputClass} min-h-[100px] resize-none`;

interface OrgTypeOption {
  value: CreatableOrganizationKind;
  labelKey: string;
  descriptionKey: string;
}

const orgTypeOptions: OrgTypeOption[] = [
  { value: 'SPORTS_ORG', labelKey: 'createOrg.typeClub', descriptionKey: 'createOrg.typeClubDesc' },
  { value: 'COMPANY', labelKey: 'createOrg.typeCompany', descriptionKey: 'createOrg.typeCompanyDesc' },
  { value: 'SPONSOR', labelKey: 'createOrg.typeSponsor', descriptionKey: 'createOrg.typeSponsorDesc' },
  { value: 'PARTNER', labelKey: 'createOrg.typeOther', descriptionKey: 'createOrg.typeOtherDesc' },
];

const buildForm = () => ({ displayName: '', description: '', kind: 'SPORTS_ORG' as CreatableOrganizationKind });

export const CreateOrganizationPage = () => {
  useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState(buildForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 4000);
  };

  const loadOrganizations = async () => {
    setOrgsLoading(true);
    try {
      setOrganizations(await fetchMyOrganizations());
    } catch {
      setOrganizations([]);
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createOrganization({
        displayName: form.displayName.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
      });
      showMessage(t('createOrg.created', { name: created.displayName }), 'success');
      setForm(buildForm());
      void loadOrganizations();
    } catch (err) {
      showMessage(extractApiErrorMessage(err, t('createOrg.createFailed')), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#0f1117] font-sans text-[#f4f4f5] selection:bg-[#16a34a]/20">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div>
          <Link to="/tournaments/setup" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
            <ArrowLeft className="h-4 w-4" />
            {t('createOrg.backToSetup')}
          </Link>
          <p className="mt-4 text-sm font-semibold text-[#16a34a]">{t('createOrg.eyebrow')}</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl">
            {t('createOrg.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#a1a1aa]">
            {t('createOrg.subtitle')}
          </p>
        </div>

        {/* Toast */}
        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            messageType === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Form */}
          <form onSubmit={handleSubmit} className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ffffff0d] bg-[#0f1117] text-[#16a34a]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f4f4f5]">{t('createOrg.title')}</p>
                <p className="text-sm text-[#a1a1aa]">{t('createOrg.subtitle')}</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#f4f4f5]">{t('createOrg.nameLabel')}</span>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
                  className={inputClass}
                  placeholder={t('createOrg.namePlaceholder')}
                  required
                />
              </label>

              <fieldset>
                <legend className="text-sm font-semibold text-[#f4f4f5]">{t('createOrg.typeLabel')}</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {orgTypeOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-all ${
                        form.kind === opt.value
                          ? 'border-[#16a34a] bg-[#16a34a]/10'
                          : 'border-[#ffffff0d] bg-[#0f1117] hover:bg-[#1a1c22]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="orgKind"
                        value={opt.value}
                        checked={form.kind === opt.value}
                        onChange={(e) => setForm((c) => ({ ...c, kind: e.target.value as CreatableOrganizationKind }))}
                        className="mt-0.5 accent-[#16a34a]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#f4f4f5]">{t(opt.labelKey)}</p>
                        <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">{t(opt.descriptionKey)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#f4f4f5]">{t('createOrg.descLabel')}</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  className={textareaClass}
                  placeholder={t('createOrg.descPlaceholder')}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Link
                to="/tournaments/setup"
                className="inline-flex items-center gap-2 rounded-full border border-[#ffffff0d] bg-[#0f1117] px-5 py-2.5 text-sm font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
              >
                {t('createOrg.cancel')}
              </Link>
              <button
                type="submit"
                disabled={saving || !form.displayName.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#22c55e] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('createOrg.create')}
              </button>
            </div>
          </form>

          {/* Sidebar — My Organizations */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
              <div className="border-b border-[#ffffff0d] px-6 py-5">
                <p className="text-sm font-semibold text-[#f4f4f5]">{t('createOrg.myOrganizations')}</p>
                <p className="mt-1 text-sm text-[#a1a1aa]">{t('createOrg.myOrganizationsHint')}</p>
              </div>
              {orgsLoading ? (
                <div className="flex items-center justify-center px-6 py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" />
                </div>
              ) : organizations.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-[#a1a1aa]">
                  {t('createOrg.noOrganizations')}
                </div>
              ) : (
                <div className="max-h-[400px] divide-y divide-[#ffffff0d] overflow-y-auto">
                  {organizations.map((org) => (
                    <div key={org.id} className="px-6 py-4">
                      <p className="text-sm font-semibold text-[#f4f4f5]">{org.displayName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#1a1c22] px-2.5 py-1 text-xs font-medium text-[#a1a1aa]">{membershipRoleLabel(org.membershipRole)}</span>
                        <span className="rounded-full bg-[#1a1c22] px-2.5 py-1 text-xs font-medium text-[#a1a1aa]">{organizationKindLabel(org.primaryKind)}</span>
                        {org.canCreateTournament && (
                          <span className="rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-xs font-semibold text-[#16a34a]">{t('createOrg.eventAccess')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Badge, Field } from '../../../design/primitives';
import type { ClubJob, ClubJobCategory, ClubJobEngagementType, ClubJobPayload } from '../../clubs/api';
import { appliesInApp, categoryName, engagementName, ENGAGEMENT_TYPES, JOB_CATEGORIES, levelName } from './labels';
import { JevAdvice } from '../../jev/JevAdvice';
import { CommerceEditor, EditorChecklist, EditorDiscardPrompt, EditorPreview, EditorSection } from './CommerceEditor';

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];
const LEVELS = ['ANY', 'EXPERIENCED', 'LICENSED'];
const REQUIRED_ROLES = ['PLAYER', 'COACH', 'CLUB_ADMIN'];
/** Posting or editing an ongoing club role on one page. `recovery` shows the latest saved posting after a conflict. */
export const RoleForm = ({ clubId, job, saving, formError, recovery, onCancel, onSubmit }: {
    clubId: number; job: ClubJob | null; saving: boolean; formError: string | null; recovery?: ReactNode;
    onCancel: () => void; onSubmit: (payload: ClubJobPayload) => Promise<void>;
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useCommerceDraftState('form:title', job?.title ?? '');
    const [description, setDescription] = useCommerceDraftState('form:description', job?.description ?? '');
    const [ageGroup, setAgeGroup] = useCommerceDraftState('form:ageGroup', job?.ageGroup ?? '');
    const [level, setLevel] = useCommerceDraftState('form:level', job?.level ?? '');
    const [requiredRole, setRequiredRole] = useCommerceDraftState('form:requiredRole', job?.requiredRole ?? '');
    const [category, setCategory] = useCommerceDraftState<ClubJobCategory>('form:category', job?.category ?? 'OTHER');
    const [engagementType, setEngagementType] = useCommerceDraftState<ClubJobEngagementType>('form:engagementType', job?.engagementType ?? 'UNSPECIFIED');
    const [discard, setDiscard] = useState(false);
    const inApp = appliesInApp(requiredRole);
    const dirty = JSON.stringify([title, description, ageGroup, level, requiredRole, category, engagementType])
        !== JSON.stringify([job?.title ?? '', job?.description ?? '', job?.ageGroup ?? '', job?.level ?? '', job?.requiredRole ?? '', job?.category ?? 'OTHER', job?.engagementType ?? 'UNSPECIFIED']);
    return <CommerceEditor title={job ? t('jobs.editPosting') : 'Post a role'} formLabel="Role editor" backLabel="Back to open roles" closeLabel="Close role editor" saveLabel={t('jobs.save')}
        description="Describe the work and the commitment, and choose how candidates get in touch." saving={saving}
        footerNote={job ? `Saving keeps this posting ${job.status === 'CLOSED' ? 'closed' : 'open'}.` : 'Saving opens the posting to candidates straight away.'}
        onRequestClose={() => { if (dirty) setDiscard(true); else onCancel(); }}
        onSubmit={event => { event.preventDefault(); if (!saving) void onSubmit({ title: title.trim(), description, ageGroup, level, requiredRole, category, engagementType }); }}
        feedback={formError && <><div className="gk-notice gk-notice--danger"><span className="cm-notice__text"><span role="alert">{formError}</span><span>Your edits are kept.</span></span></div>{recovery}</>}
        confirmation={discard && <EditorDiscardPrompt label="Discard job edits" disabled={saving} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel} />}
        preview={<>
            <EditorPreview label="Role preview" footnote={inApp ? 'Candidates apply in GrassKickZ. You review them from this posting.' : 'Candidates use your club’s public contact details. Keep them current.'}>
                <span className="cm-preview__icon" aria-hidden="true"><Briefcase /></span>
                <h3>{title.trim() || 'Your next club opening'}</h3>
                <p className="cm-preview__tags"><Badge>{categoryName(category)}</Badge><Badge>{engagementName(engagementType)}</Badge>{ageGroup && <Badge>{ageGroup}</Badge>}{level && level !== 'ANY' && <Badge>{levelName(level)}</Badge>}</p>
                <p className="cm-preview__text">{description.trim() || 'Explain the responsibilities, the expected commitment and what your club offers.'}</p>
            </EditorPreview>
            <EditorChecklist title="Before you save" items={[
                { label: 'A clear role title', complete: !!title.trim() },
                { label: 'Responsibilities and commitment (recommended)', complete: !!description.trim() },
                { label: 'Paid or volunteer terms (recommended)', complete: engagementType !== 'UNSPECIFIED' },
            ]} />
        </>}>
        <EditorSection title="The role" description="A specific title and enough detail for candidates to decide whether it fits them.">
            <Field label="Role title" htmlFor="role-title"><input id="role-title" className="gk-input" autoFocus required maxLength={120} placeholder={t('jobs.titlePlaceholder')} value={title} onChange={event => setTitle(event.target.value)} /></Field>
            <Field label="Role description" htmlFor="role-description" hint={`Responsibilities, place, days or hours, experience and what the club offers · ${description.length}/2000`}>
                <textarea id="role-description" className="gk-input" rows={5} maxLength={2000} placeholder={t('jobs.descriptionPlaceholder')} value={description} onChange={event => setDescription(event.target.value)} /></Field>
            <div className="cm-pair">
                <Field label="Football role" htmlFor="role-category"><select id="role-category" className="gk-input" value={category} onChange={event => setCategory(event.target.value as ClubJobCategory)}>{JOB_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
                <Field label="Engagement type" htmlFor="role-engagement"><select id="role-engagement" className="gk-input" value={engagementType} onChange={event => setEngagementType(event.target.value as ClubJobEngagementType)}>{ENGAGEMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
            </div>
        </EditorSection>
        <EditorSection title="Who can apply and how" description="Narrow the opening to an age group or experience level only when it matters.">
            <div className="cm-pair">
                <Field label="Age group" htmlFor="role-age"><select id="role-age" className="gk-input" value={ageGroup} onChange={event => setAgeGroup(event.target.value)}><option value="">{t('jobs.ageGroupAny')}</option>{AGE_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}</select></Field>
                <Field label="Experience level" htmlFor="role-level"><select id="role-level" className="gk-input" value={level} onChange={event => setLevel(event.target.value)}><option value="">{t('jobs.levelAny')}</option>{LEVELS.map(item => <option key={item} value={item}>{levelName(item)}</option>)}</select></Field>
            </div>
            <Field label="Application route" htmlFor="role-route" hint={inApp ? 'Candidates apply in GrassKickZ. Open the posting’s applicants to review and respond.' : 'Candidates are sent to your club’s contact details. Add a contact method to the description.'}>
                <select id="role-route" className="gk-input" value={requiredRole} onChange={event => setRequiredRole(event.target.value)}><option value="">Contact the club</option>
                    {REQUIRED_ROLES.map(role => <option key={role} value={role}>{role === 'CLUB_ADMIN' ? 'Club admin (contact the club)' : `${levelName(role)} application in GrassKickZ`}</option>)}</select></Field>
        </EditorSection>
        <EditorSection title="Writing help" description="Optional suggestions for the title, description and category.">
            <JevAdvice endpoint={`/jev/listings/${clubId}`} kind="listing" input={{ title, description, category, engagement: engagementType }} disabled={saving || !title.trim()}
                onApply={value => { if (JOB_CATEGORIES.some(item => item.value === value)) setCategory(value as ClubJobCategory); }} />
        </EditorSection>
    </CommerceEditor>;
};

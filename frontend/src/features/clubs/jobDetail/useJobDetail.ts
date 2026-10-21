import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchMyJobApplication, fetchPublicJob, type ClubJob, type MyJobApplication } from '../api';
import { useJobsOpportunitiesCopy } from '../jobsOpportunitiesCopy';

export type JobViewerStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

/**
 * One open role and the viewer's application to it. Each answer belongs to the request that asked for it, so a new
 * role, a new viewer or asking again never shows an older answer as current. `retryJob` asks for the role again;
 * `reload` asks again for the application (after an error, or when it changed).
 */
export function useJobDetail(id: number, status: JobViewerStatus, userId: number | undefined) {
    const { copy } = useJobsOpportunitiesCopy();
    const [jobAttempt, setJobAttempt] = useState(0), [applicationAttempt, setApplicationAttempt] = useState(0);
    const jobKey = `${id}:${jobAttempt}`, applicationKey = `${id}:${status}:${userId ?? ''}:${applicationAttempt}`;
    const [jobResult, setJobResult] = useState<{ key: string; job: ClubJob | null; error: string }>();
    const [applicationResult, setApplicationResult] = useState<{ key: string; application: MyJobApplication | null; error: string }>();
    useEffect(() => {
        const controller = new AbortController();
        void fetchPublicJob(id, controller.signal)
            .then((job) => { if (!controller.signal.aborted) setJobResult({ key: jobKey, job, error: '' }); })
            .catch(() => { if (!controller.signal.aborted) setJobResult({ key: jobKey, job: null, error: 'load' }); });
        return () => controller.abort();
    }, [id, jobKey]);
    useEffect(() => {
        if (status !== 'authenticated') return;
        const controller = new AbortController();
        void fetchMyJobApplication(id, controller.signal)
            .then((application) => { if (!controller.signal.aborted) setApplicationResult({ key: applicationKey, application, error: '' }); })
            .catch((failure) => { if (!controller.signal.aborted) setApplicationResult({ key: applicationKey, application: null, error: extractApiErrorMessage(failure, copy('statusLoadError')) }); });
        return () => controller.abort();
    }, [copy, id, status, applicationKey]);
    const job = jobResult?.key === jobKey ? jobResult : undefined;
    const application = status === 'authenticated' && applicationResult?.key === applicationKey ? applicationResult : undefined;
    return {
        job: job?.job ?? null, error: job?.error ?? '', loading: !job,
        application: application?.application ?? null, applicationError: application?.error ?? '',
        checking: status === 'bootstrapping' || (status === 'authenticated' && !application),
        /** Shows an application just sent, until the next answer from the server. */
        setApplication: (value: MyJobApplication) => setApplicationResult({ key: applicationKey, application: value, error: '' }),
        retryJob: () => setJobAttempt((n) => n + 1),
        reload: () => setApplicationAttempt((n) => n + 1),
    };
}

export type JobDetailState = ReturnType<typeof useJobDetail>;

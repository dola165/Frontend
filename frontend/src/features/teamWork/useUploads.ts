import { useUploads } from '../../components/work/useUploads';
import { addFile, addPicture, addPlanFile, addPlanPicture, addPlanVideo, addVideo, type Detail, type PlanView } from './api';

/** Uploads under one task: pictures, videos and files, each its own way in. */
export const useTaskUploads = (itemId: number, onChanged: (detail: Detail) => void) => useUploads<Detail>({
    picture: file => addPicture(itemId, file),
    video: (file, onProgress) => addVideo(itemId, file, onProgress),
    file: (file, onProgress) => addFile(itemId, file, onProgress),
}, onChanged);

/** Uploads on one plan, the same three ways in. */
export const usePlanUploads = (planId: number, onChanged: (view: PlanView) => void) => useUploads<PlanView>({
    picture: file => addPlanPicture(planId, file),
    video: (file, onProgress) => addPlanVideo(planId, file, onProgress),
    file: (file, onProgress) => addPlanFile(planId, file, onProgress),
}, onChanged);

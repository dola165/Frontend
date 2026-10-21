import type { JoiningSetup } from '../../joining-contract/types';
import type { GroupEditorContext } from './GroupEditor';

export function joiningSetupInitial(setup: JoiningSetup): GroupEditorContext['initial'] {
 const known=setup.known;
 return {
  name:setup.programmeName||setup.squadName||known.name||'',
  squadId:setup.squadId,
  gender:known.gender==='MALE'||known.gender==='FEMALE'?known.gender:'ANY',
  responsibleUserId:setup.staff.some(person=>person.id===known.headCoachId)?known.headCoachId:null,
  // Public programme prices are reference material. Joining fees/terms need explicit review.
  published:false,
 };
}

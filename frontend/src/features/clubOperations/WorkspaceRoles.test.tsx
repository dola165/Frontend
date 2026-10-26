import { describe, expect, it } from 'vitest';
import { focusedBootstrap, type RolesWorkspace } from './useWorkspaceRoles';
import type { Bootstrap } from './api';
const data:RolesWorkspace={leadership:false,actorId:2,catalog:[{key:'STRENGTH_CONDITIONING',title:'Gym & conditioning coach',description:'Training and development',permissions:['DEVELOPMENT:WRITE']}],views:[],current:{id:'appointment-5',label:'Equipment',modules:['EQUIPMENT'],squadIds:[11],clubWide:false,appointmentId:5,revision:3},requestSquads:[{id:11,name:'U12'},{id:12,name:'U16'}],squads:[],people:[],sessions:[],requests:[],invitations:[]};data.views=[data.current];
describe('A focused workspace view',()=>{
 it('narrows editor choices without inventing write access',()=>{
  const boot={squads:data.requestSquads,people:[],guardians:[],modules:[{id:'EQUIPMENT',globalWrite:true,writable:true,writeSquads:[11,12]},{id:'MEDICAL',globalWrite:false,writable:false,writeSquads:[]}],links:[],sessions:[]} as unknown as Bootstrap;
  const scoped=focusedBootstrap(boot,data);
  expect(scoped.modules).toEqual([{id:'EQUIPMENT',globalWrite:false,writable:true,writeSquads:[11]}]);expect(scoped.squads.map(s=>s.id)).toEqual([11]);expect(scoped.defaultSquadId).toBe(11);
 });
});

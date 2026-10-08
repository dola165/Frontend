import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import MyClubOperationsPage from '../../pages/MyClubOperationsPage';
import { FamilyPlanWindow } from './FamilyPlanWindow';

export function ResponsibilitiesWindow({open,onClose}:{open:boolean;onClose:()=>void}) {
 return <FamilyPlanWindow open={open} onClose={onClose} title="Club responsibilities"><Link className="mp-link journey-map-link" to="/club-operations">Open full responsibilities page <ArrowUpRight size={15}/></Link><MyClubOperationsPage embedded/></FamilyPlanWindow>;
}

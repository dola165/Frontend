import { Link } from 'react-router-dom';
import { useTryoutCopy } from '../tryouts/tryoutCopy';
import './recruitment-offers.css';
export function TryoutEntry({tryoutId}:{tryoutId:number}) {
 const copy = useTryoutCopy();
 if (!Number.isSafeInteger(tryoutId) || tryoutId <= 0) return null;
 return <Link className="recruitment-primary" to={`/tryouts/${tryoutId}`}>{copy('View tryout and application', 'სინჯისა და განაცხადის ნახვა')}</Link>;
}

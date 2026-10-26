import { useAuth } from '../../../context/AuthContext';
import { mayCreatePages } from '../model/kinds';
import { ageFromDob } from './useCreatePage';

/** Whether this person may start a page at all: pages are for adults, so under 18 every way in is hidden. */
export const useMayCreatePages = () => mayCreatePages(ageFromDob(useAuth().user?.dob));

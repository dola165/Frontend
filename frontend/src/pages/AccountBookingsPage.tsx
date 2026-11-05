import { Link, useSearchParams } from 'react-router-dom';
import { MyVenueBookings } from '../features/venues/VenueBookings';
import { useAccountCopy } from '../features/profiles/account/accountCopy';
import { btnSecondaryClass } from '../features/profiles/account/accountModel';
import { useAuth } from '../context/AuthContext';
import '../components/workspace/workspace-shell.css';

export const AccountBookingsPage = () => {
    const copy = useAccountCopy();
    const [params] = useSearchParams();
    const { user } = useAuth();
    const booking = params.get('booking') ?? '';
    const focusedBookingId = /^[1-9]\d*$/.test(booking) && Number.isSafeInteger(Number(booking)) ? Number(booking) : undefined;
    const closure = params.get('returnTo') === 'closure';
    const reviewPath = user?.onboardingRequired ? '/onboarding?accountClosure=review' : '/account?tab=danger';
    return <div className="workspace-page-shell grid gap-5 pb-10 [--venue-accent:var(--fc-accent)] [--venue-accent-soft:var(--fc-accent-soft)]">
        <header className="grid gap-3 border-b border-[var(--fc-border)] pb-5">
            <h1 className="text-xl font-bold">{copy('Your reservations', 'თქვენი ჯავშნები')}</h1>
            <nav className="flex flex-wrap gap-3" aria-label={copy('Account navigation', 'ანგარიშის ნავიგაცია')}>
                <Link className={`${btnSecondaryClass} min-h-11`} to={closure ? reviewPath : user?.onboardingRequired ? '/onboarding' : '/account'}>
                    {closure ? copy('Review account closure again', 'ანგარიშის დახურვის ხელახლა შემოწმება') : copy('Account Settings')}
                </Link>
                {focusedBookingId && <Link className={`${btnSecondaryClass} min-h-11`} to={closure ? '/account/bookings?returnTo=closure' : '/account/bookings'}>{copy('All reservations', 'ყველა ჯავშანი')}</Link>}
            </nav>
        </header>
        <MyVenueBookings focusedBookingId={focusedBookingId} closureRecovery={closure} />
    </div>;
};

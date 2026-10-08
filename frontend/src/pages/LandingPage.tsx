import { lazy, Suspense, useState, type FormEvent, type MouseEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Expand, Loader2, Pause, Play } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSecondFactorLogin } from '../components/auth/useSecondFactorLogin';
import { SecondFactorPrompt } from '../components/auth/SecondFactorPrompt';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import { LandingStory } from '../components/landing/LandingStory';
import { LandingLightField, LandingLightRails } from '../components/landing/LandingLightField';
import { MapExperience } from '../components/map/MapExperience';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { requiredAccountStep, resolvePostAuthRedirect } from '../utils/authRedirect';
import '../components/landing/landing.css';
import '../components/landing/role-scenes.css';
import '../components/landing/landing-stadium.css';
import '../components/landing/landing-chapters.css';
import '../components/landing/landing-night.css';
import '../components/landing/landing-electric.css';

const Playground = lazy(() => import('../components/landing/LandingPlayground').then(module => ({ default: module.LandingPlayground })));

export const LandingPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, loginWithAccessToken } = useAuth();
    const secondFactor = useSecondFactorLogin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [playgroundActive, setPlaygroundActive] = useState(false);
    const [motionPaused, setMotionPaused] = useState(false);
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');
    const authenticatedRoute = user?.profileComplete ? nextPath : '/onboarding';

    const handleSectionLink = (event: MouseEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
        const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
        const section = anchor && document.getElementById(anchor.hash.slice(1));
        if (!section) return;
        // Keep in-page exploration out of the router's route-reset lifecycle.
        event.preventDefault();
        if (!section.hasAttribute('tabindex')) section.tabIndex = -1;
        section.focus({ preventScroll: true });
        section.scrollIntoView({ behavior: motionPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    };

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        if (isLoggingIn) return;
        setIsLoggingIn(true);
        setAuthError(null);
        try {
            const result = await secondFactor.authenticate({ kind: 'password', email: email.trim(), password });
            if (!result) return;
            setPassword('');
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            navigate(requiredAccountStep({ ...authenticatedUser, mustChangePassword: result.mustChangePassword === true || authenticatedUser.mustChangePassword }) || nextPath);
        } catch (error) {
            setAuthError(extractApiErrorMessage(error, 'Unable to log in. Check your email and password and try again.'));
        } finally { setIsLoggingIn(false); }
    };

    return <div className="gk-landing" data-motion={motionPaused || playgroundActive ? 'paused' : 'playing'} onClick={handleSectionLink}>
        <LandingLightField paused={motionPaused || playgroundActive} />
        <a className="landing-skip" href="#landing-login">Skip to sign in</a>
        <header className="landing-header">
            <div className="landing-wrap landing-header-inner">
                <Link to={isAuthenticated ? authenticatedRoute : '/'} aria-label="GrassKickZ home"><GrasskickzLogo wordmark /></Link>
                <nav aria-label="Landing navigation">
                    <a href="#the-game">Why GrassKickZ</a>
                    <a href="#landing-volunteer">Give back <ArrowUpRight size={14} /></a>
                    <a className="landing-nav-login" href="#landing-login">{isAuthenticated ? 'Your account' : 'Log in'} <ArrowRight size={15} /></a>
                </nav>
            </div>
        </header>
        <div className="landing-daylight"><LandingLightRails /><section className="landing-entry landing-wrap" aria-labelledby="landing-title">
            <div className="landing-intro">
                <div><p className="landing-eyebrow"><span className="landing-live-dot" /> Connecting the game</p><h1 id="landing-title">Find your place in football<span>.</span></h1></div>
                <p>A club around the corner. A team that feels like home.<br className="landing-desktop-break" /> Your football community starts here.</p>
            </div>
            <div className="landing-entry-grid">
                <section className="landing-map-card" aria-label="Discover football clubs">
                    <div id="club-map" className="landing-map-viewport" data-landing-map data-landing-map-viewport><MapExperience darkMode={false} context="guest" allowedEntityTypes={['CLUB']} mapTheme="light" filterLayout="external" embedded compactControls /></div>
                    <Link className="landing-map-expand" to="/world" aria-label="Open full map" title="Open full map"><Expand size={16} /></Link>
                </section>
                <aside className="landing-auth" id="landing-login" tabIndex={-1} aria-label="Your GrassKickZ account">
                    {isAuthenticated ? <><p className="landing-eyebrow">Back where you belong</p><h2>Welcome back,<br />{user?.fullName || user?.username || 'player'}<span>.</span></h2><p>{user?.profileComplete ? 'Your clubs, conversations, and next match are waiting.' : 'A few more details and you’re ready to find your people.'}</p><Link className="landing-button landing-button-primary" to={authenticatedRoute}>{user?.profileComplete ? 'Open Home' : 'Finish setup'} <ArrowRight size={17} /></Link><Link className="landing-text-link" to="/clubs">Explore clubs <ArrowUpRight size={15} /></Link></> : <>
                        <p className="landing-eyebrow">Already part of the game?</p><h2>Welcome back<span>.</span></h2><p>Good to have you on the team.</p>
                        {secondFactor.challenge ? <SecondFactorPrompt pending={secondFactor.pending} error={secondFactor.error} onSubmit={code => void secondFactor.submit(code)} onCancel={() => { secondFactor.cancel(); setPassword(''); }} /> : <form onSubmit={handleLogin} aria-label="Log in to GrassKickZ">
                            <label htmlFor="landing-email">Email</label><input id="landing-email" type="email" name="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required />
                            <div className="landing-password-label"><label htmlFor="landing-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
                            <input id="landing-password" type="password" name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" required />
                            {authError && <p className="landing-auth-error" role="alert">{authError}</p>}
                            <button className="landing-button landing-button-primary" type="submit" disabled={isLoggingIn}>{isLoggingIn ? <><Loader2 size={17} className="landing-spin" /> Signing in…</> : <>Log in <ArrowRight size={17} /></>}</button>
                        </form>}
                        <div className="landing-auth-divider"><span>New to GrassKickZ?</span></div><Link className="landing-button landing-button-outline" to="/signup">Create an account <ArrowUpRight size={16} /></Link>
                    </>}
                    <div className="landing-auth-note"><span className="landing-small-pitch" aria-hidden="true" /> A place for everyone who loves the game.</div>
                </aside>
            </div>
            <div className="landing-scroll-row"><a className="landing-scroll-invite" href="#the-game"><span>More than a place on the map</span><ArrowDown size={17} /></a><span className="landing-scroll-line" /><Link className="landing-map-list-link" to="/clubs">Prefer a list? <ArrowUpRight size={13} /></Link><button className="landing-motion-toggle" type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? <Play size={13} /> : <Pause size={13} />}<span>{motionPaused ? 'Play motion' : 'Pause motion'}</span></button></div>
        </section></div>
        <LandingStory motionPaused={motionPaused} onPlay={() => setPlaygroundActive(true)} />
        <footer className="landing-footer"><div className="landing-wrap">
            <div className="landing-footer-top"><Link to="/" aria-label="GrassKickZ home"><GrasskickzLogo /></Link><p>For the love of the game.<br />And everything around it.</p><nav aria-label="Footer navigation"><Link to="/world">The map</Link><Link to="/clubs">Clubs</Link><Link to="/jobs">Opportunities</Link><Link to="/signup">Join GrassKickZ <ArrowUpRight size={14} /></Link></nav></div>
            <div className="landing-footer-bottom"><span>© {new Date().getFullYear()} GrassKickZ</span><span>Connecting the game, from the ground up.</span><button className="landing-playground-door" aria-label="Open Playground" onClick={() => setPlaygroundActive(true)}><span aria-hidden="true">⚽</span><span>A little extra time?</span></button></div>
        </div></footer>
        {playgroundActive && <Suspense fallback={<div className="landing-playground-loading" role="status">Getting the pitch ready… <button onClick={() => setPlaygroundActive(false)}>Cancel</button></div>}><Playground active onActiveChange={setPlaygroundActive} /></Suspense>}
    </div>;
};

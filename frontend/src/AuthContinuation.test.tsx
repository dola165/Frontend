import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import './i18n';
import { clearAuthFlow, getAuthFlow } from './utils/authRedirect';

const scenario=vi.hoisted(()=>({needsOnboarding:false}));
vi.mock('./android/bridge',async original=>({...await original<typeof import('./android/bridge')>(),isAndroidApp:true,nativeCall:vi.fn().mockResolvedValue({status:204})}));
vi.mock('@react-oauth/google',()=>({GoogleLogin:()=>null}));
vi.mock('./components/layout/TopNav',()=>({TopNav:()=>null}));
vi.mock('./pages/FeedPage',()=>({FeedPage:()=> <h1>Home feed destination</h1>}));
vi.mock('./pages/OnboardingPage',()=>({OnboardingPage:()=> <h1>Required onboarding destination</h1>}));
vi.mock('./features/clubs/api',()=>({fetchMyClubMembershipContext:vi.fn().mockResolvedValue({hasClubMembership:false})}));
vi.mock('./features/squadEnrollment/api',()=>({resolveInvitation:vi.fn().mockResolvedValue({squadId:5,squadName:'U12 welcome squad',clubName:'Academy',expiresAt:'2099-01-01',children:[]})}));
// This suite isolates auth continuation. Production capability routing is covered
// separately by FootballWorkflowRoutes.
vi.mock('./features/capabilities/ExtensionBoundary',()=>({ExtensionRoute:({children}:{children:ReactNode})=>children}));
vi.mock('./components/auth/useSecondFactorLogin',()=>({useSecondFactorLogin:()=>({challenge:false,pending:false,error:null,authenticate:async()=>({accessToken:'synthetic-parent-token'}),cancel:vi.fn(),submit:vi.fn()})}));
vi.mock('./context/AuthContext',async()=>{
    const {createContext,useContext,useState}=await import('react');
    type User=import('./context/AuthContext').AuthUser;
    type Value=ReturnType<typeof import('./context/AuthContext').useAuth>;
    const Context=createContext<Value|null>(null);
    return {
        AuthProvider:({children}:{children:ReactNode})=>{
            const [user,setUser]=useState<User|null>(null);
            const loginWithAccessToken=async()=>{
                const next:User={id:7,role:'PARENT',fullName:'Parent Tester',profileComplete:!scenario.needsOnboarding,onboardingRequired:scenario.needsOnboarding,mustChangePassword:false,emailVerified:true};
                // AuthSessionBoundary remounts the actual app layout as a new account is installed.
                setUser(next);
                await Promise.resolve();
                return next;
            };
            const value={user,status:user?'authenticated':'anonymous',sessionId:user?'parent-session':'guest-session',isAuthenticated:Boolean(user),isBootstrapping:false,loginWithAccessToken,bootstrapSession:async()=>user,refreshNavigationCapabilities:async()=>{},logout:async()=>setUser(null)} as Value;
            return <Context.Provider value={value}>{children}</Context.Provider>;
        },
        useAuth:()=>{const value=useContext(Context);if(!value)throw new Error('Missing test auth provider');return value;},
    };
});
import App from './App';

beforeEach(()=>{clearAuthFlow();scenario.needsOnboarding=false;window.history.replaceState({},'', '/join-squad#synthetic-squad-invitation');});
afterEach(()=>{cleanup();clearAuthFlow();window.history.replaceState({},'','/');});
async function signIn(){
    const user=userEvent.setup();
    await user.type(await screen.findByLabelText(/^Email/i),'parent@example.test');
    await user.type(screen.getByLabelText(/^Password$/i),'synthetic-password');
    const password=screen.getByLabelText(/^Password$/i);
    const form=password.closest('form');if(!form)throw new Error('Login form missing');
    await user.click(form.querySelector('button[type="submit"]') as HTMLButtonElement);
}
it('returns a guest to the fragment invitation after real login and account-boundary remount',async()=>{
    render(<App/>);
    await screen.findByLabelText(/^Email/i);
    expect(window.location.pathname).toBe('/login');expect(window.location.search).toBe('');expect(window.location.hash).toBe('');
    expect(getAuthFlow().nextPath).toBe('/join-squad#synthetic-squad-invitation');
    await signIn();
    expect(await screen.findByRole('heading',{name:'U12 welcome squad'})).toBeInTheDocument();
    expect(window.location.pathname+window.location.hash).toBe('/join-squad#synthetic-squad-invitation');
    await waitFor(()=>expect(getAuthFlow().nextPath).toBeUndefined());
    expect(screen.queryByRole('heading',{name:'Home feed destination'})).not.toBeInTheDocument();
});
it('retains the private destination while required onboarding is unfinished',async()=>{
    scenario.needsOnboarding=true;render(<App/>);await signIn();
    expect(await screen.findByRole('heading',{name:'Required onboarding destination'})).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');expect(getAuthFlow().nextPath).toBe('/join-squad#synthetic-squad-invitation');
});

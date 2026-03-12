import { Link } from 'react-router-dom';
import BallLogo from '../components/BallLogo';
import { colors } from '../theme';

export default function Welcome() {
    const btnStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        maxWidth: '300px',
        padding: '16px 24px',
        borderRadius: '12px',
        fontSize: '17px',
        fontWeight: '700',
        textDecoration: 'none',
        transition: 'transform 0.2s',
        marginBottom: '12px'
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(160deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
        }}>
            <BallLogo size={100} />
            <h1 className="manga-title text-5xl text-white mt-6 mb-12 italic uppercase tracking-tighter">TALANTI</h1>

            <div className="w-full flex flex-col items-center px-6">
                {/* Direct link to Spring Boot Google OAuth2 trigger */}
                <a href="http://localhost:8080/oauth2/authorization/google"
                   style={{ ...btnStyle, background: 'white', color: 'black' }}
                   className="hover:scale-105 shadow-xl">
                    <img src="https://www.svgrepo.com/show/355037/google.svg" width="20" alt="Google" />
                    SIGN IN WITH GOOGLE
                </a>

                <Link to="/signup"
                      style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', color: 'white', border: '2px solid white' }}
                      className="hover:bg-white/20">
                    CREATE ACCOUNT
                </Link>

                <Link to="/login" style={{ color: white, marginTop: '20px', fontWeight: '600', textDecoration: 'none' }}>
                    Already have an account? Log In
                </Link>
            </div>
        </div>
    );
}
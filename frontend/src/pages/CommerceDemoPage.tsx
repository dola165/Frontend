import { Navigate, useSearchParams } from 'react-router-dom';

/** Keep old bookmarks working while the temporary simulation lives in the real flows. */
export const CommerceDemoPage = () => {
    const [params] = useSearchParams();
    return <Navigate to={params.get('section') === 'campaigns' ? '/campaigns' : '/store'} replace />;
};

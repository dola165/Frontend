import './george-branding.css';
import { BrandMark } from '../../components/layout/BrandMark';

/** Each style keeps its own George artwork. */
export function GeorgeMark({ size = 28 }: { size?: number }) {
    return <BrandMark variant="george" size={size} className="george-mark" />;
}

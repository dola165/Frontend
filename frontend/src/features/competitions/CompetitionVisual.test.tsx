import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompetitionVisual } from './CompetitionVisual';
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'en'}})}));
vi.mock('../../components/ui/MediaImage',()=>({MediaImage:(props:React.ImgHTMLAttributes<HTMLImageElement>)=><img {...props}/>}));
describe('Competition photography',()=>{
  it('prefers an upload, recovers to disclosed stock, then a stable identity if both fail',()=>{
    const {container}=render(<CompetitionVisual id={1} name="Academy Cup" imageUrl="/media/cup.jpg"/>);
    expect(container.querySelector('img')).toHaveAttribute('src','/media/cup.jpg');
    expect(screen.queryByText('Football stock photo')).not.toBeInTheDocument();
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toHaveAttribute('src','/venue-demo/pitch-aerial.jpg');
    expect(screen.getByText('Football stock photo')).toBeVisible();
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();expect(screen.getByText('AC')).toBeInTheDocument();
  });
  it('uses indoor stock for futsal and responds to a changed upload',()=>{
    const {container,rerender}=render(<CompetitionVisual id={2} name="Futsal Cup" discipline="FUTSAL"/>);
    expect(container.querySelector('img')).toHaveAttribute('src','/venue-demo/pitch-indoor.jpg');
    rerender(<CompetitionVisual id={2} name="Futsal Cup" discipline="FUTSAL" imageUrl="/media/new.jpg"/>);
    expect(container.querySelector('img')).toHaveAttribute('src','/media/new.jpg');
    expect(screen.queryByText('Football stock photo')).not.toBeInTheDocument();
  });
});

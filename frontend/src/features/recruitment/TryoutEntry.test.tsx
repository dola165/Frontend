import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it} from 'vitest';
import '../../i18n';
import {TryoutEntry} from './TryoutEntry';
afterEach(cleanup);
it('takes map visitors to the canonical detail and current receipt before applying',()=>{
 render(<MemoryRouter><TryoutEntry tryoutId={12}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'View tryout and application'})).toHaveAttribute('href','/tryouts/12');
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('does not produce a route for an invalid map identity',()=>{
 render(<MemoryRouter><TryoutEntry tryoutId={0}/></MemoryRouter>);
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

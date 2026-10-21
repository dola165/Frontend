import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompetitionCapacity } from './CompetitionCapacity';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
describe('Competition capacity', () => {
  it.each([0, 4, 16])('exposes actual occupancy at %s of 16 entries', count => {
    render(<CompetitionCapacity count={count} capacity={16} name="Academy Cup"/>);
    const meter = screen.getByRole('meter', { name: 'Academy Cup: entry capacity' });
    expect(meter).toHaveAttribute('aria-valuenow', String(count));
    expect(meter).toHaveAttribute('aria-valuemax', '16');
    expect(screen.getByText(`${count} / 16 entries`)).toBeVisible();
    expect(meter.firstChild).toHaveStyle({ width: `${count / 16 * 100}%` });
  });
  it('keeps an over-capacity count truthful while bounding the meter', () => {
    render(<CompetitionCapacity count={18} capacity={16} name="Cup"/>);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '16');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '18 / 16 entries');
    expect(screen.getByRole('meter').firstChild).toHaveStyle({ width: '100%' });
  });
  it.each([undefined, null, 0, -1, Infinity])('does not invent progress when capacity is %s', capacity => {
    render(<CompetitionCapacity count={3} capacity={capacity} name="Cup"/>);
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText('3 entries')).toBeVisible();
  });
});

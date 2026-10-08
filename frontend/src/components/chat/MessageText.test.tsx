import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MessageText } from './MessageText';

it('opens a shared match inside the app, including its appointment anchor', () => {
  render(<MemoryRouter><Routes><Route path="/" element={<MessageText text={`Please review (${window.location.origin}/match-exchange/42#appointment-7).`} />} /><Route path="/match-exchange/42" element={<h1>Match invitation</h1>} /></Routes></MemoryRouter>);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '/match-exchange/42#appointment-7');
  fireEvent.click(link);
  expect(screen.getByRole('heading', { name: 'Match invitation' })).toBeInTheDocument();
});

it('keeps markup and unsafe schemes as text and safely links external HTTP URLs', () => {
  const text = '<img src=x onerror=alert(1)> javascript:alert(1) https://example.test/rules?a=1&b=2';
  render(<MemoryRouter><MessageText text={text} /></MemoryRouter>);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.test/rules?a=1&b=2');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByText(/javascript:alert/)).toBeInTheDocument();
});

it('does not reinterpret a same-origin double-slash path as an external host', () => {
  const url = `${window.location.origin}//elsewhere.test/match`;
  render(<MemoryRouter><MessageText text={url} /></MemoryRouter>);
  expect(screen.getByRole('link')).toHaveAttribute('href', url);
});

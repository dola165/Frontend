import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StoreProductForm } from '../../tabs/StoreTab';
import { CampaignForm } from '../../tabs/CampaignsTab';

it('Escape asks before discarding a product and Keep editing returns keyboard focus to the unchanged field', () => {
    const onCancel = vi.fn();
    render(<StrictMode><StoreProductForm product={null} saving={false} formError="" onCancel={onCancel} onSubmit={vi.fn()}/></StrictMode>);
    const name = screen.getByLabelText('Product name');
    fireEvent.change(name, { target: { value: 'Youth home kit' } });
    name.focus();
    fireEvent.keyDown(name, { key: 'Escape' });
    expect(screen.getByRole('group', { name: 'Discard edits' })).toHaveFocus();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(name).toHaveValue('Youth home kit');
    expect(name).toHaveFocus();
    fireEvent.keyDown(name, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect(onCancel).toHaveBeenCalledOnce();
});

it('a pending save blocks the keyboard close path and duplicate submission', () => {
    const onCancel = vi.fn(), onSubmit = vi.fn();
    render(<StoreProductForm product={null} saving formError="" onCancel={onCancel} onSubmit={onSubmit}/>);
    const form = screen.getByRole('form', { name: 'Product editor' });
    fireEvent.keyDown(form, { key: 'Escape' });
    fireEvent.submit(form);
    expect(screen.queryByRole('group', { name: 'Discard edits' })).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close editor' })).toBeDisabled();
});

it('campaign readiness leaves title-only drafts savable and previews the current unsaved title', () => {
    const onSubmit = vi.fn();
    render(<CampaignForm campaign={null} saving={false} error="" onCancel={vi.fn()} onSubmit={onSubmit}/>);
    fireEvent.change(screen.getByLabelText('Campaign title'), { target: { value: 'New training goals' } });
    const preview = screen.getByRole('region', { name: 'Campaign preview' });
    expect(within(preview).getByRole('heading', { name: 'New training goals' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'New training goals', summary: '', goalAmount: null }));
    expect(screen.getByText('Your campaign stays a draft until you publish it from the campaign list.')).toBeInTheDocument();
});

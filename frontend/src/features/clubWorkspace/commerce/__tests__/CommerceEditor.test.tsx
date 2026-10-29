import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StoreProductForm } from '../StoreProductForm';

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

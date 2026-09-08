import { fireEvent, render, screen } from '@testing-library/react';
import {
    DirectoryChoiceList,
    DirectoryFilterChipRow,
    DirectoryFilterShell
} from '../DirectoryFilterShell';
import { DirectoryFilterDrawer } from '../DirectoryFilterDrawer';
import { DirectoryToolbar } from '../DirectoryToolbar';
import { DirectoryRangeFilter } from '../DirectoryRangeFilter';

describe('directory filter primitives', () => {
    it('renders controlled choices and emits the selected value', () => {
        const onToggle = vi.fn();

        render(
            <DirectoryChoiceList
                options={[{ value: 'academy', label: 'Academy' }]}
                selectedValues={[]}
                onToggle={onToggle}
            />
        );

        const option = screen.getByRole('button', { name: 'Academy' });
        expect(option).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(option);
        expect(onToggle).toHaveBeenCalledWith('academy');
    });

    it('keeps shell clear actions and active chip removal explicit', () => {
        const onClear = vi.fn();
        const onRemove = vi.fn();

        render(
            <DirectoryFilterShell title="Filter clubs" hasActiveFilters onClear={onClear}>
                <DirectoryFilterChipRow
                    chips={[{ id: 'type:academy', label: 'Academy' }]}
                    onRemove={onRemove}
                />
            </DirectoryFilterShell>
        );

        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        fireEvent.click(screen.getByRole('button', { name: /remove filter academy/i }));
        expect(onClear).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith('type:academy');
    });

    it('renders the mobile drawer only when open and closes from the backdrop', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <DirectoryFilterDrawer open={false} title="Filters" closeLabel="Close filters" onClose={onClose}>
                <p>Filter content</p>
            </DirectoryFilterDrawer>
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(
            <DirectoryFilterDrawer open title="Filters" closeLabel="Close filters" onClose={onClose}>
                <p>Filter content</p>
            </DirectoryFilterDrawer>
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Filter content')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Close filters' })[0]);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps keyboard focus inside the open drawer and closes on Escape', () => {
        const onClose = vi.fn();

        render(
            <DirectoryFilterDrawer open title="Filters" closeLabel="Close filters" onClose={onClose}>
                <button type="button">First filter control</button>
            </DirectoryFilterDrawer>
        );

        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getAllByRole('button', { name: 'Close filters' })[1];
        const filterButton = screen.getByRole('button', { name: 'First filter control' });

        filterButton.focus();
        fireEvent.keyDown(dialog, { key: 'Tab' });
        expect(document.activeElement).toBe(closeButton);

        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(filterButton);

        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the shared toolbar search, sorting and filter trigger controlled', () => {
        const onSearchChange = vi.fn();
        const onSortChange = vi.fn();
        const onOpenFilters = vi.fn();

        render(
            <DirectoryToolbar
                search="boots"
                searchLabel="Search products"
                searchPlaceholder="Search products"
                resultCount={2}
                sort="NEWEST"
                sortOptions={[{ value: 'NEWEST', label: 'Newest' }]}
                hasActiveFilters
                filtersOpen={false}
                filterLabel="Filters"
                activeFilterChips={[{ id: 'category', label: 'Footwear' }]}
                accent="amber"
                onSearchChange={onSearchChange}
                onSortChange={onSortChange}
                onClearFilters={vi.fn()}
                onRemoveFilter={vi.fn()}
                onOpenFilters={onOpenFilters}
            />
        );

        fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'shirt' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Sort results' }), { target: { value: 'NEWEST' } });
        fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
        expect(onSearchChange).toHaveBeenCalledWith('shirt');
        expect(onSortChange).toHaveBeenCalledWith('NEWEST');
        expect(onOpenFilters).toHaveBeenCalledTimes(1);
    });

    it('keeps range inputs and handles within the selected bounds', () => {
        const onChange = vi.fn();

        render(<DirectoryRangeFilter min={0} max={200} lowerValue={25} upperValue={150} onChange={onChange} />);

        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum' }), { target: { value: '50' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum' }), { target: { value: '175' } });
        expect(onChange).toHaveBeenNthCalledWith(1, 50, 150);
        expect(onChange).toHaveBeenNthCalledWith(2, 25, 175);
    });
});

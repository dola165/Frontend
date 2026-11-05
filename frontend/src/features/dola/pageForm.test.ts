import { afterEach, expect, it } from 'vitest';
import { findField, onPage, opensOnce, readPageForm } from './pageForm';

afterEach(() => { document.body.innerHTML = ''; });

const page = (html: string) => { document.body.innerHTML = `<header><input aria-label="Search people"></header><main>${html}</main>`; };

it('reads each field’s label and whether it is filled, never its value', () => {
    page(`<h1>Club settings</h1>
        <section><h2>About</h2>
            <label>Club name <input name="name" value="Dinamo" required></label>
            <label for="about">Description</label><textarea id="about"></textarea>
        </section>
        <section><h2>Contacts</h2>
            <label>Contact email *<input type="email"></label>
            <label>Country<select name="country"><option value="">Choose</option><option value="GE">Georgia</option></select></label>
            <label>Password<input type="password"></label>
            <label>Read only<input readonly value="x"></label>
            <div data-dola-field="logo" data-dola-label="Logo" data-dola-filled="false"><button type="button">Upload</button><input type="file" style="display:none"></div>
            <label>Find a parent club<input></label>
            <label>Sponsor logo<input type="file"></label>
            <details><summary>More details</summary><label>Equipment fee<input name="equipmentFee"></label></details>
        </section>`);

    const form = readPageForm();

    expect(form?.title).toBe('Club settings');
    expect(form?.fields).toEqual([
        { key: 'logo', label: 'Logo', required: false, filled: false, kind: 'file', section: 'Contacts' },
        { key: 'name', label: 'Club name', required: true, filled: true, kind: 'text', section: 'About' },
        { key: 'about', label: 'Description', required: false, filled: false, kind: 'textarea', section: 'About' },
        { key: 'label:contact email', label: 'Contact email', required: true, filled: false, kind: 'email', section: 'Contacts' },
        { key: 'country', label: 'Country', required: false, filled: false, kind: 'select', section: 'Contacts' },
    ]);
    expect(JSON.stringify(form)).not.toContain('Dinamo');
});

it('has no form on a page without one, and leaves the header and Dola out', () => {
    page('<h1>Home</h1><aside class="tw-dola"><textarea aria-label="Message to Dola"></textarea></aside>');
    expect(readPageForm()).toBeNull();
});

it('finds a field again by its marker, id, name or label, and frames its whole label', () => {
    page(`<label data-dola-field="bio"><span>Bio</span><textarea></textarea></label>
        <label>Contact email<input type="email"></label>
        <input id="phone" aria-label="Phone"><button data-dola-action="save">Save</button>`);

    expect(findField('bio')?.tagName).toBe('LABEL');
    expect(findField('label:contact email')?.textContent).toContain('Contact email');
    expect(findField('phone')?.id).toBe('phone');
    expect(findField('save')?.textContent).toBe('Save');
    expect(findField('missing', 'Contact email')?.tagName).toBe('LABEL');
    expect(findField('missing')).toBeNull();
});

it('knows when the guide’s page is the one on screen', () => {
    expect(onPage('/account?tab=profile', '/account', '?tab=profile&x=1')).toBe(true);
    expect(onPage('/account?tab=profile', '/account', '?tab=security')).toBe(false);
    expect(onPage('/clubs/1/profile-settings', '/clubs/1/profile-settings', '')).toBe(true);
    expect(onPage('/clubs/1/profile-settings', '/clubs/2/profile-settings', '')).toBe(false);
});

it('counts a window opened by a one-shot flag as open after the flag is tidied away', () => {
    // `/calendar?newEvent=1` opens the New event window, then the calendar removes the flag.
    expect(onPage('/calendar?newEvent=1', '/calendar', '')).toBe(true);
    expect(onPage('/calendar?newEvent=1', '/calendar', '?newEvent=1')).toBe(true);
    expect(onPage('/calendar?newEvent=1', '/home', '')).toBe(false);
    expect(opensOnce('/calendar?newEvent=1')).toBe(true);
    expect(opensOnce('/jobs/new?as=hire')).toBe(false);
    // Other parameters still have to match.
    expect(onPage('/jobs/new?as=hire', '/jobs/new', '')).toBe(false);
});

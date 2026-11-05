import { readPageTitle } from '../../components/layout/header/pins/describeRoute';

/**
 * Reads the form on the page the person has open, for Agent Dola's "what's missing here?": each field's key, label and
 * whether it has a value — never the value itself. The same rules find a field again to frame it during a guide, so a
 * key read here always leads back to its field.
 *
 * A page can help: `data-dola-field="key"` names a field (and `data-dola-filled` says whether it is filled when the
 * control is hidden, such as a photo upload); `data-dola-action="key"` names a button a guide can point at (Save);
 * `data-dola-ignore` keeps a part of the page out.
 */
export interface PageField { key: string; label: string | null; required: boolean; filled: boolean; kind: string; section: string | null }
export interface PageForm { title: string | null; fields: PageField[] }

/** Never "the page's form": the app header and navigation, Dola itself, search boxes. */
const OUTSIDE = 'header, nav, [role="banner"], [role="search"], .tw-dola, .tw-dola-launch, .dola-guide, [data-dola-ignore]';
const CONTROLS = 'input, select, textarea, [contenteditable="true"], [role="radiogroup"]';
const SKIPPED = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password']);
const MAX_FIELDS = 80;

const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
/** A label without its required marker: "Contact email *" → "Contact email". */
export const plainLabel = (text: string | null | undefined) => words(text).replace(/\s*\*\s*$/, '').trim();
const css = (value: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&'));
/** React's generated ids (":r1:", "«r1»") change between visits, so they never become keys. */
const stableId = (id: string) => Boolean(id) && !/^[:«]/.test(id);

/** jsdom (the tests) lays nothing out, so there "visible" only means not hidden by style. */
const layoutless = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function visible(element: HTMLElement) {
    if (element.closest('[aria-hidden="true"], [hidden], [inert]')) return false;
    // A collapsed section ("More details") keeps its fields in the page but out of sight.
    const collapsed = element.closest('details:not([open])');
    if (collapsed && !element.closest('summary')) return false;
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (layoutless) return true;
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/** A box to find something ("Find a parent club", "Search players"), not a field of the page's own record. */
const SEARCH = /^(find|search|look up|filter|ძებნა|მოძებნე|იპოვე)\b/i;
const isSearch = (control: HTMLElement, label: string | null) => SEARCH.test(label ?? '')
    || /search/i.test(control.id || control.getAttribute('name') || '') || control.getAttribute('aria-autocomplete') === 'list';

/** The text of an element without the text of the controls inside it (a select's options are not its label). */
function ownText(element: Element) {
    const copy = element.cloneNode(true) as Element;
    copy.querySelectorAll('input, select, textarea, option, button, [contenteditable="true"]').forEach(node => node.remove());
    return plainLabel(copy.textContent);
}

/** What the person sees as the field's name. */
export function labelOf(control: HTMLElement): string | null {
    const labelledBy = control.getAttribute('aria-labelledby');
    if (labelledBy) {
        const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
        if (plainLabel(text)) return plainLabel(text);
    }
    if (control.id) {
        const forLabel = document.querySelector(`label[for="${css(control.id)}"]`);
        if (forLabel && ownText(forLabel)) return ownText(forLabel);
    }
    const wrapping = control.closest('label');
    if (wrapping && ownText(wrapping)) return ownText(wrapping);
    const field = control.closest('.gk-field, [data-field]');
    const fieldLabel = field?.querySelector('label, .gk-field__label, legend');
    if (fieldLabel && ownText(fieldLabel)) return ownText(fieldLabel);
    return plainLabel(control.getAttribute('aria-label') || control.getAttribute('placeholder') || control.getAttribute('title')) || null;
}

/** How a field is found again: its marker, a stable id, its name, else its label. */
function keyOf(control: HTMLElement, label: string | null): string | null {
    const marked = control.closest<HTMLElement>('[data-dola-field]')?.dataset.dolaField;
    if (marked) return marked;
    if (stableId(control.id)) return control.id;
    const name = control.getAttribute('name');
    if (name) return name;
    return label ? `label:${label.toLowerCase()}` : null;
}

function kindOf(control: HTMLElement) {
    if (control.getAttribute('role') === 'radiogroup') return 'choice';
    if (control.isContentEditable) return 'text';
    const tag = control.tagName.toLowerCase();
    return tag === 'input' ? (control as HTMLInputElement).type || 'text' : tag;
}

/** Whether the field holds something: a value, a choice, a ticked box or a chosen file. */
export function isFilled(control: HTMLElement): boolean {
    const marked = control.closest<HTMLElement>('[data-dola-filled]')?.dataset.dolaFilled;
    if (marked === 'true' || marked === 'false') return marked === 'true';
    if (control.getAttribute('role') === 'radiogroup') return Boolean(control.querySelector('[aria-checked="true"], input:checked'));
    if (control.isContentEditable) return words(control.textContent).length > 0;
    if (control instanceof HTMLInputElement) {
        if (control.type === 'checkbox') return control.checked;
        if (control.type === 'radio') {
            const group = control.name ? document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${css(control.name)}"]`) : [control];
            return Array.from(group).some(radio => radio.checked);
        }
        if (control.type === 'file') return Boolean(control.files?.length);
        return control.value.trim().length > 0;
    }
    if (control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) return control.value.trim().length > 0;
    return false;
}

const isRequired = (control: HTMLElement, label: string | null, rawLabel: string) =>
    (control as HTMLInputElement).required || control.getAttribute('aria-required') === 'true'
    || control.closest<HTMLElement>('[data-dola-required="true"]') !== null || (Boolean(label) && /\*\s*$/.test(rawLabel));

function sectionOf(control: HTMLElement) {
    const heading = control.closest('section, fieldset')?.querySelector('h2, h3, legend');
    return heading ? words(heading.textContent).slice(0, 200) || null : null;
}

/** Where the person fills things in: the dialog or drawer open over the page (the last one opened), else the page. */
function root() {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(dialog => !dialog.closest(OUTSIDE));
    return dialogs.at(-1) ?? document.querySelector<HTMLElement>('main') ?? document.body;
}

/** The form on screen, or `null` when the page has none. Values are never read out. */
export function readPageForm(): PageForm | null {
    const fields: PageField[] = [];
    const seen = new Set<string>();
    const add = (field: PageField) => {
        if (seen.has(field.key) || fields.length >= MAX_FIELDS) return;
        seen.add(field.key);
        fields.push(field);
    };
    const page = root();
    // Fields the page names itself (also hidden uploads, which show a button instead of their input).
    page.querySelectorAll<HTMLElement>('[data-dola-field]').forEach(box => {
        if (box.closest(OUTSIDE) || !visible(box)) return;
        const control = box.matches(CONTROLS) ? box : box.querySelector<HTMLElement>(CONTROLS) ?? box;
        const rawLabel = box.dataset.dolaLabel ?? labelOf(control) ?? ownText(box);
        const label = plainLabel(rawLabel) || null;
        add({ key: box.dataset.dolaField!, label, required: isRequired(control, label, rawLabel ?? ''), filled: isFilled(control),
            kind: kindOf(control), section: sectionOf(box) });
    });
    page.querySelectorAll<HTMLElement>(CONTROLS).forEach(control => {
        if (control.closest(OUTSIDE) || control.closest('[data-dola-field]') || !visible(control)) return;
        if (control.closest('[role="radiogroup"]') && control.getAttribute('role') !== 'radiogroup') return;
        if (control instanceof HTMLInputElement && (SKIPPED.has(control.type) || control.readOnly || control.disabled)) return;
        if ((control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) && control.disabled) return;
        if (control instanceof HTMLTextAreaElement && control.readOnly) return;
        const label = labelOf(control);
        const key = keyOf(control, label);
        if (!key || !label || isSearch(control, label)) return;
        // An upload the page doesn't name is usually part of something added (a sponsor's logo), not a missing field.
        if (control instanceof HTMLInputElement && control.type === 'file' && !control.required) return;
        const rawLabel = (control.id && document.querySelector(`label[for="${css(control.id)}"]`)?.textContent) || control.closest('label')?.textContent || label;
        add({ key, label: label.slice(0, 200), required: isRequired(control, label, words(rawLabel)), filled: isFilled(control),
            kind: kindOf(control), section: sectionOf(control) });
    });
    if (fields.length === 0) return null;
    const title = readPageTitle() || words(page.querySelector('h1')?.textContent) || null;
    return { title: title?.slice(0, 200) ?? null, fields };
}

/** The visible box to frame for a field: its label wrapper or field container, else the control itself. */
function frameOf(element: HTMLElement): HTMLElement {
    if (element.matches('[data-dola-field], [data-dola-action]')) return element;
    return element.closest<HTMLElement>('label') ?? element.closest<HTMLElement>('.gk-field, [data-field]') ?? element;
}

/**
 * Finds a field again from its key (as read above, or as Dola names it) to frame it; the label is the fallback when
 * the key is not on this page. `null` when the field is not on screen.
 */
export function findField(target: string, label?: string | null): HTMLElement | null {
    const page = root();
    const pick = (element: Element | null) => element instanceof HTMLElement && visible(element) && !element.closest(OUTSIDE) ? frameOf(element) : null;
    const marked = pick(page.querySelector(`[data-dola-field="${css(target)}"], [data-dola-action="${css(target)}"]`));
    if (marked) return marked;
    const byLabel = (text: string) => {
        const wanted = plainLabel(text).toLowerCase();
        if (!wanted) return null;
        for (const control of Array.from(page.querySelectorAll<HTMLElement>(CONTROLS))) {
            if (labelOf(control)?.toLowerCase() === wanted) {
                const found = pick(control);
                if (found) return found;
            }
        }
        return null;
    };
    if (target.startsWith('label:')) return byLabel(target.slice('label:'.length)) ?? (label ? byLabel(label) : null);
    return pick(stableId(target) ? document.getElementById(target) : null)
        ?? pick(page.querySelector(`[name="${css(target)}"]`))
        ?? (label ? byLabel(label) : null);
}

/** The control inside a framed field, to read whether it is filled and to put the cursor there. */
export function controlIn(box: HTMLElement): HTMLElement | null {
    return box.matches(CONTROLS) ? box : box.querySelector<HTMLElement>(CONTROLS);
}

/** Whether `webPath` is the page on screen: the same path, and every query value it names. */
/**
 * Flags that open a window once and are then tidied out of the address (`/calendar?newEvent=1` opens the event editor):
 * a guide's page counts as open without them, and starting such a guide always goes to its address, so it opens.
 */
const ONE_SHOT = new Set(['newEvent']);
export const opensOnce = (webPath: string) => Array.from(new URL(webPath, window.location.origin).searchParams.keys()).some(name => ONE_SHOT.has(name));

export function onPage(webPath: string, pathname: string, search: string) {
    const url = new URL(webPath, window.location.origin);
    if (url.pathname !== pathname) return false;
    const here = new URLSearchParams(search);
    return Array.from(url.searchParams.entries()).every(([name, value]) => here.get(name) === value || (ONE_SHOT.has(name) && !here.has(name)));
}

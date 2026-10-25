/**
 * The editor library's colours, taken from our design tokens on the editor's own root, so its panels, buttons and
 * marks follow the app's dark and light themes. Nothing here is a colour of its own.
 */
export interface EditorColours { theme: { palette: Record<string, string>; typography: { fontFamily: string } }; mark: string }

export function editorColours(root: HTMLElement): EditorColours {
    const styles = getComputedStyle(root);
    const token = (name: string) => styles.getPropertyValue(`--gk-${name}`).trim();
    const [bg, surface, raised, sunken, line, lineStrong, text, text2, text3, accent, accentStrong, onAccent, warning, danger, info] =
        ['bg', 'surface', 'raised', 'sunken', 'line', 'line-strong', 'text', 'text-2', 'text-3', 'accent', 'accent-strong', 'on-accent', 'warning', 'danger', 'info'].map(token);
    const soft = (colour: string, percent: number) => `color-mix(in srgb, ${colour} ${percent}%, transparent)`;
    return {
        mark: danger,
        theme: {
            typography: { fontFamily: styles.getPropertyValue('--gk-font').trim() },
            palette: {
                'bg-primary': surface, 'bg-secondary': sunken, 'bg-stateless': surface, 'bg-active': raised, 'bg-hover': raised,
                'bg-primary-light': raised, 'bg-primary-hover': raised, 'bg-primary-active': raised, 'bg-primary-stateless': surface,
                'bg-primary-0-5-opacity': soft(surface, 50), 'bg-base-light': raised, 'bg-base-medium': sunken, 'bg-grey': raised,
                'bg-tooltip': raised,
                'accent-primary': accent, 'accent-primary-hover': accentStrong, 'accent-primary-active': accentStrong,
                'accent-primary-disabled': line, 'accent-secondary-disabled': line, 'accent-stateless': accent,
                'accent-stateless_0_4_opacity': soft(accent, 40), accent_0_5_opacity: soft(accent, 5), accent_0_5_5_opacity: soft(accent, 5),
                accent_0_7_opacity: soft(accent, 70), accent_1_2_opacity: soft(accent, 12), accent_1_8_opacity: soft(accent, 18),
                accent_2_8_opacity: soft(accent, 28), accent_4_0_opacity: soft(accent, 40), extra_0_7_overlay: soft(bg, 70),
                'txt-primary': text, 'txt-secondary': text2, 'txt-secondary-invert': onAccent, 'txt-placeholder': text3,
                'txt-warning': warning, 'txt-error': danger, 'txt-info': info,
                'icon-primary': text, 'icons-primary-opacity-0-6': soft(text, 60), 'icons-secondary': text2, 'icons-placeholder': text3,
                'icons-invert': onAccent, 'icons-muted': text3, 'icons-primary-hover': text, 'icons-secondary-hover': text,
                'btn-primary-text': onAccent, 'btn-primary-text-0-6': soft(onAccent, 60), 'btn-primary-text-0-4': soft(onAccent, 40),
                'btn-disabled-text': text3, 'btn-secondary-text': text,
                'link-primary': text, 'link-stateless': text2, 'link-hover': accent, 'link-active': accent, 'link-muted': text3, 'link-pressed': accentStrong,
                'borders-primary': lineStrong, 'borders-primary-hover': text3, 'borders-secondary': line, 'borders-strong': lineStrong,
                'borders-invert': onAccent, 'border-hover-bottom': accent, 'border-active-bottom': accent, 'border-primary-stateless': line,
                'borders-disabled': line, 'borders-button': lineStrong, 'borders-item': line, 'borders-base-light': line, 'borders-base-medium': lineStrong,
                'borders-green': accent, 'borders-red': danger, 'active-secondary': raised, 'active-secondary-hover': raised,
                warning, error: danger, success: accent, info, 'light-shadow': soft(bg, 30), 'medium-shadow': soft(bg, 50), 'large-shadow': soft(bg, 70),
            },
        },
    };
}

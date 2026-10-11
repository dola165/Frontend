import type { FieldId } from './fields';
import type { FieldProps } from './fields/fieldProps';
import { FIELD_VIEWS } from './fieldViews';

/** One field of the front page, by id. */
export function Field({ id, ...props }: FieldProps & { id: FieldId }) {
    const View = FIELD_VIEWS[id];
    return <View {...props} />;
}

import type {IconName} from 'components/Icon';
import MediaObject from './MediaObject';
import MediaSourceLayout from './MediaSourceLayout';
import Pager from './Pager';

export default interface MediaSource<T extends MediaObject> {
    readonly id: string;
    readonly title: string;
    readonly icon: IconName;
    readonly itemType: T['itemType'];
    readonly layout?: MediaSourceLayout<T>;
    readonly secondaryLayout?: MediaSourceLayout<MediaObject>;
    readonly tertiaryLayout?: MediaSourceLayout<MediaObject>;
    readonly searchable?: boolean;
    readonly defaultHidden?: boolean;
    readonly isPin?: boolean;
    search(params?: Record<string, unknown>): Pager<T>;
}

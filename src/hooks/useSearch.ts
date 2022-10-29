import {useEffect, useState} from 'react';
import MediaObject from 'types/MediaObject';
import MediaSource from 'types/MediaSource';
import Pager from 'types/Pager';

export default function useSearch<T extends MediaObject>(source: MediaSource<T> | null, q = '') {
    const [pager, setPager] = useState<Pager<T> | null>(null);

    useEffect(() => {
        setPager(source?.search({q}) || null);
    }, [source, q]);

    return pager;
}

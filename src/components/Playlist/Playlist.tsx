import React, {useCallback, useRef, useState} from 'react';
import {Except} from 'type-fest';
import LookupStatus from 'types/LookupStatus';
import PlaylistItem from 'types/PlaylistItem';
import playlist from 'services/playlist';
import ListView, {ListViewHandle, ListViewProps} from 'components/ListView';
import MediaListStatusBar from 'components/MediaList/MediaListStatusBar';
import useCurrentlyPlaying from 'hooks/useCurrentlyPlaying';
import useObservable from 'hooks/useObservable';
import {showMediaInfoDialog} from 'components/Media/MediaInfoDialog';
import showActionsMenu from './showActionsMenu';
import usePlaylistLayout from './usePlaylistLayout';
import './Playlist.scss';

export const droppableTypes = ['audio/*', 'video/*'];

type NotRequired = 'items' | 'itemKey' | 'layout' | 'sortable' | 'droppableTypes';

export interface PlaylistProps extends Except<ListViewProps<PlaylistItem>, NotRequired> {
    onPlay?: (item: PlaylistItem) => void;
    onEject?: () => void;
}

export default function Playlist({onSelect, onPlay, onEject, ...props}: PlaylistProps) {
    const listViewRef = useRef<ListViewHandle>(null);
    const items = useObservable(playlist.observe, []);
    const size = items.length;
    const layout = usePlaylistLayout(size);
    const currentlyPlaying = useCurrentlyPlaying();
    const [selectedCount, setSelectedCount] = useState(0);

    const itemClassName = useCallback(
        (item: PlaylistItem) => {
            const [service] = item.src.split(':');
            const playing = item.id === currentlyPlaying?.id;
            const unplayable = item.unplayable || item.lookupStatus === LookupStatus.NotFound;
            return `source-${service} ${playing ? 'playing' : ''} ${
                unplayable ? 'unplayable' : ''
            }`;
        },
        [currentlyPlaying]
    );

    const handleSelect = useCallback(
        (items: readonly PlaylistItem[]) => {
            setSelectedCount(items.length);
            onSelect?.(items);
        },
        [onSelect]
    );

    const handleDoubleClick = useCallback(
        (item: PlaylistItem) => {
            onPlay?.(item);
        },
        [onPlay]
    );

    const handleEnter = useCallback(
        (items: readonly PlaylistItem[]) => {
            if (items.length === 1) {
                onPlay?.(items[0]);
            }
        },
        [onPlay]
    );

    const handleDelete = useCallback(
        (items: readonly PlaylistItem[]) => {
            if (items.length === 1 && items[0] === currentlyPlaying) {
                onEject?.();
            } else {
                playlist.remove(items);
            }
        },
        [onEject, currentlyPlaying]
    );

    const handleInfo = useCallback(([item]: readonly PlaylistItem[]) => {
        if (item) {
            showMediaInfoDialog(item);
        }
    }, []);

    const handleContextMenu = useCallback(
        async (selectedItems: readonly PlaylistItem[], x: number, y: number, rowIndex: number) => {
            if (items.length === 0) {
                return;
            }
            const action = await showActionsMenu(items, selectedItems, x, y, rowIndex);
            switch (action) {
                case 'play':
                    onPlay?.(selectedItems[0]);
                    break;

                case 'remove':
                    playlist.remove(selectedItems);
                    break;

                case 'info':
                    showMediaInfoDialog(selectedItems[0]);
                    break;

                case 'select-all':
                    listViewRef.current!.selectAll();
                    break;

                case 'clear':
                    playlist.clear();
                    break;
            }
        },
        [onPlay, items]
    );

    return (
        <div className="playlist">
            <ListView
                {...props}
                className="media-list"
                layout={layout}
                items={items}
                itemKey="id"
                itemClassName={itemClassName}
                droppable={true}
                droppableTypes={droppableTypes}
                multiSelect={true}
                reorderable={true}
                onContextMenu={handleContextMenu}
                onDelete={handleDelete}
                onDoubleClick={handleDoubleClick}
                onDrop={playlist.insertAt}
                onEnter={handleEnter}
                onInfo={handleInfo}
                onMove={playlist.moveSelection}
                onSelect={handleSelect}
                listViewRef={listViewRef}
            />
            <MediaListStatusBar items={items} size={items.length} selectedCount={selectedCount} />
        </div>
    );
}

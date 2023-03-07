import React from 'react';
import PlaylistItem from 'types/PlaylistItem';
import {browser} from 'utils';
import PopupMenu, {
    PopupMenuItem,
    PopupMenuProps,
    PopupMenuSeparator,
    showPopupMenu,
} from 'components/PopupMenu';

export default async function showActionsMenu(
    items: readonly PlaylistItem[],
    selectedItems: readonly PlaylistItem[],
    rowIndex: number,
    x: number,
    y: number,
    align: 'left' | 'right' = 'left'
): Promise<string | undefined> {
    return showPopupMenu(
        (props: PopupMenuProps) => (
            <ActionsMenu
                {...props}
                items={items}
                selectedItems={selectedItems}
                rowIndex={rowIndex}
            />
        ),
        x,
        y,
        align
    );
}

interface ActionsMenuProps extends PopupMenuProps {
    items: readonly PlaylistItem[];
    selectedItems: readonly PlaylistItem[];
    rowIndex: number;
}

function ActionsMenu({items, selectedItems, rowIndex, ...props}: ActionsMenuProps) {
    const itemCount = items.length;
    const selectedCount = selectedItems.length;
    const isEmpty = itemCount === 0;
    const allSelected = selectedCount === itemCount;
    const isSingleSelection = selectedCount === 1;

    return (
        <PopupMenu {...props}>
            {rowIndex === -1 ? null : (
                <>
                    {isSingleSelection ? (
                        <PopupMenuItem
                            label="Play"
                            value="play"
                            acceleratorKey="Enter"
                            key="play"
                        />
                    ) : null}
                    <PopupMenuItem
                        label="Remove"
                        value="remove"
                        acceleratorKey="Del"
                        key="remove"
                    />
                    {isSingleSelection ? (
                        <PopupMenuItem
                            label="Info..."
                            value="info"
                            acceleratorKey={`${browser.ctrlKeyStr}+I`}
                            key="info"
                        />
                    ) : null}
                </>
            )}
            <PopupMenuSeparator />
            {allSelected ? null : (
                <PopupMenuItem
                    label="Select all"
                    value="select-all"
                    acceleratorKey={`${browser.ctrlKeyStr}+A`}
                    key="select-all"
                />
            )}
            {!isSingleSelection && isContiguousSelection(items, selectedItems) ? (
                <PopupMenuItem
                    label="Reverse selection"
                    value="reverse-selection"
                    key="reverse-selection"
                />
            ) : null}
            <PopupMenuSeparator />
            {isEmpty ? null : <PopupMenuItem label="Clear" value="clear" key="clear" />}
        </PopupMenu>
    );
}

function isContiguousSelection(
    items: readonly PlaylistItem[],
    selectedItems: readonly PlaylistItem[]
): boolean {
    const startIndex = items.findIndex((item) => item === selectedItems[0]);
    return selectedItems.every((item, index) => item === items[startIndex + index]);
}

import type {Observable} from 'rxjs';
import MediaAlbum from './MediaAlbum';
import MediaItem from './MediaItem';
import PlaylistItem from './PlaylistItem';

export default interface Playlist {
    readonly atEnd: boolean;
    readonly atStart: boolean;
    observe(): Observable<readonly PlaylistItem[]>;
    observeCurrentIndex(): Observable<number>;
    observeCurrentItem(): Observable<PlaylistItem | null>;
    observeNextItem(): Observable<PlaylistItem | null>;
    observeSize(): Observable<number>;
    getCurrentItem(): PlaylistItem | null;
    setCurrentItem(item: PlaylistItem): void;
    add(album: MediaAlbum): Promise<void>;
    add(item: MediaItem): Promise<void>;
    add(items: readonly MediaItem[]): Promise<void>;
    add(file: File): Promise<void>;
    add(files: readonly File[]): Promise<void>;
    add(files: FileList): Promise<void>;
    clear(): void;
    eject(): void;
    insert(album: MediaAlbum): Promise<void>;
    insert(item: MediaItem): Promise<void>;
    insert(items: readonly MediaItem[]): Promise<void>;
    insert(file: File): Promise<void>;
    insert(files: readonly File[]): Promise<void>;
    insert(files: FileList): Promise<void>;
    insertAt(album: MediaAlbum, index: number): Promise<void>;
    insertAt(item: MediaItem, index: number): Promise<void>;
    insertAt(items: readonly MediaItem[], index: number): Promise<void>;
    insertAt(file: File, index: number): Promise<void>;
    insertAt(files: readonly File[], index: number): Promise<void>;
    insertAt(files: FileList, index: number): Promise<void>;
    insertAt(items: readonly MediaItem[] | FileList, index: number): Promise<void>;
    moveSelection(selection: readonly PlaylistItem[], toIndex: number): void;
    remove(item: PlaylistItem): void;
    remove(items: readonly PlaylistItem[]): void;
    removeAt(index: number): void;
    next(): void;
    prev(): void;
    shuffle(): void;
}

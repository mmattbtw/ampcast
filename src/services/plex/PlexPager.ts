import type {Observable} from 'rxjs';
import {Subscription, mergeMap} from 'rxjs';
import {SetOptional, Writable} from 'type-fest';
import ItemType from 'types/ItemType';
import MediaAlbum from 'types/MediaAlbum';
import MediaArtist from 'types/MediaArtist';
import MediaFolder from 'types/MediaFolder';
import MediaFolderItem from 'types/MediaFolderItem';
import MediaItem from 'types/MediaItem';
import MediaObject from 'types/MediaObject';
import MediaPlaylist from 'types/MediaPlaylist';
import MediaType from 'types/MediaType';
import Pager, {Page, PagerConfig} from 'types/Pager';
import ParentOf from 'types/ParentOf';
import Thumbnail from 'types/Thumbnail';
import {Logger, uniq} from 'utils';
import {dispatchMediaObjectChanges} from 'services/actions/mediaObjectChanges';
import AbstractPager from 'services/pagers/AbstractPager';
import OffsetPager from 'services/pagers/OffsetPager';
import SimplePager from 'services/pagers/SimplePager';
import SimpleMediaPager from 'services/pagers/SimpleMediaPager';
import WrappedPager from 'services/pagers/WrappedPager';
import fetchFirstPage from 'services/pagers/fetchFirstPage';
import pinStore from 'services/pins/pinStore';
import plexApi, {PlexRequest, getMusicLibraryPath} from './plexApi';
import plexItemType from './plexItemType';
import plexMediaType from './plexMediaType';
import plexSettings from './plexSettings';

const logger = new Logger('PlexPager');

export default class PlexPager<T extends MediaObject> implements Pager<T> {
    static minPageSize = 10;
    static plexMaxPageSize = 1000;

    private readonly pager: AbstractPager<T>;
    private readonly pageSize: number;
    private pageNumber = 1;
    private subscriptions?: Subscription;

    constructor(
        private readonly request: PlexRequest,
        private readonly options?: Partial<PagerConfig>,
        private readonly parent?: ParentOf<T>
    ) {
        let pageSize = options?.pageSize;
        if (!pageSize) {
            pageSize = plexSettings.connection?.local ? PlexPager.plexMaxPageSize : 200;
        }
        this.pageSize = Math.min(options?.maxSize || Infinity, pageSize);
        const config = {...options, pageSize: this.pageSize};
        this.pager = new OffsetPager<T>((pageNumber) => this.fetch(pageNumber), config);
    }

    get maxSize(): number | undefined {
        return this.pager.maxSize;
    }

    observeBusy(): Observable<boolean> {
        return this.pager.observeBusy();
    }

    observeItems(): Observable<readonly T[]> {
        return this.pager.observeItems();
    }

    observeSize(): Observable<number> {
        return this.pager.observeSize();
    }

    observeError(): Observable<unknown> {
        return this.pager.observeError();
    }

    disconnect(): void {
        this.pager.disconnect();
        this.subscriptions?.unsubscribe();
    }

    fetchAt(index: number, length: number): void {
        if (!this.subscriptions) {
            this.connect();
        }

        this.pager.fetchAt(index, length);
    }

    private get isSearch(): boolean {
        return this.request.path.endsWith('/search');
    }

    private connect(): void {
        if (!this.subscriptions) {
            this.subscriptions = new Subscription();

            // Items from the `/search` endpoints are already enhanced.
            if (!this.options?.lookup && !this.isSearch) {
                this.subscriptions.add(
                    this.pager
                        .observeAdditions()
                        .pipe(mergeMap((items) => this.enhanceItems(items)))
                        .subscribe(logger)
                );
            }
        }
    }

    private async enhanceItems(items: readonly T[]): Promise<void> {
        const enhance = async (items: readonly T[], host?: string): Promise<void> => {
            items = items.filter(
                (item) => !(item.itemType === ItemType.Media && item.mediaType === MediaType.Video)
            );
            if (items.length > 0) {
                const plexObjects = await plexApi.getMetadata(
                    items.map(({src}): string => {
                        const [, , ratingKey] = src.split(':');
                        return ratingKey;
                    }),
                    host
                );
                const plexAlbums = await this.getPlexAlbums(plexObjects);
                const enhancedItems = plexObjects.map(
                    (object: plex.MediaObject) => this.createMediaObject(object, plexAlbums, true) // no pager
                );
                dispatchMediaObjectChanges<MediaObject>(
                    enhancedItems.map((item) => ({
                        match: (object: MediaObject) => object.src === item.src,
                        values: item,
                    }))
                );
            }
        };
        await Promise.all([
            enhance(
                items.filter((item) => [ItemType.Media, ItemType.Album].includes(item.itemType))
            ),
        ]);
    }

    private async fetch(pageNumber: number): Promise<Page<T>> {
        let plexItems: readonly plex.MediaObject[];
        let plexAlbums: readonly plex.Album[] = [];
        let total = 0;
        if (this.isSearch) {
            plexItems = await plexApi.search(this.request);
            total = plexItems.length;
        } else {
            const {headers, ...request} = this.request;
            const result = await plexApi.fetchJSON<plex.MetadataResponse>({
                ...request,
                headers: {
                    ...headers,
                    'X-Plex-Container-Size': String(this.pageSize),
                    'X-Plex-Container-Start': String((pageNumber - 1) * this.pageSize),
                },
            });
            const {
                MediaContainer: {Metadata = [], size, totalSize},
            } = result;

            plexItems = Metadata;
            total = totalSize || size;
        }

        if (this.options?.lookup) {
            // The lookup service uses `/library/search`.
            // Search results are already enhanced so we'll fetch the albums
            // to give us the `release_mbid`.
            plexAlbums = await this.getPlexAlbums(plexItems);
        }

        const items = plexItems.map((item: plex.MediaObject) =>
            this.createMediaObject(item, plexAlbums)
        );

        return {items, total};
    }

    private async fetchNext(): Promise<Page<T>> {
        const page = await this.fetch(this.pageNumber);
        this.pageNumber++;
        return page;
    }

    private createMediaObject(
        object: plex.MediaObject,
        albums: readonly plex.Album[],
        noPager?: boolean
    ): T {
        switch (object.type) {
            case plexItemType.Clip:
                return this.createMediaItemFromVideo(object) as T;

            case plexItemType.Album:
                return this.createMediaAlbum(object, noPager) as T;

            case plexItemType.Artist:
                return this.createMediaArtist(object, noPager) as T;

            case plexItemType.Playlist:
                return this.createMediaPlaylist(object, noPager) as T;

            case plexItemType.Track: {
                const album = albums.find((album) => album.ratingKey === object.parentRatingKey);
                return this.createMediaItemFromTrack(object, album) as T;
            }

            default:
                return this.createMediaFolder(object) as T;
        }
    }

    private createMediaItemFromTrack(track: plex.Track, album: plex.Album | undefined): MediaItem {
        const media = track.Media?.[0];
        const part = media?.Part?.[0];
        const stream = part?.Stream?.find((stream) => stream.streamType === 2);
        let title = (track.title || '').trim();
        const hasMetadata = !!title;
        const albumTitle = hasMetadata
            ? track.parentTitle === '[Unknown Album]'
                ? undefined
                : track.parentTitle || undefined
            : undefined;
        const fileName = this.getFileName(part?.file) || '[Unknown]';
        title = title || fileName.replace(/\.\w+/, '');
        const parseNumber = (value = ''): number | undefined => {
            const gain = parseFloat(value);
            return isNaN(gain) ? undefined : gain;
        };

        return {
            src: this.getSrc('audio', track),
            srcs: track.Media?.map(({Part: [part]}) => part.key),
            itemType: ItemType.Media,
            mediaType: MediaType.Audio,
            title,
            fileName,
            externalUrl: this.getExternalUrl(track),
            addedAt: track.addedAt,
            artists: hasMetadata
                ? track.originalTitle
                    ? [track.originalTitle]
                    : track.grandparentTitle
                    ? [track.grandparentTitle]
                    : undefined
                : undefined,
            albumArtist: albumTitle && !track.originalTitle ? track.grandparentTitle : undefined,
            album: albumTitle,
            duration: track.duration / 1000,
            track: albumTitle ? track.index : undefined,
            disc: albumTitle && track.index ? track.parentIndex : undefined,
            rating: this.getRating(track.userRating),
            globalRating: this.getRating(track.rating),
            year: track.year || track.parentYear,
            playedAt: track.lastViewedAt || 0,
            playCount: track.viewCount,
            genres: this.getGenres(track) || (album ? this.getGenres(album) : undefined),
            thumbnails: this.createThumbnails(
                track.thumb || track.parentThumb || track.grandparentThumb
            ),
            release_mbid: album ? this.getMbid(album) : undefined,
            track_mbid: this.getMbid(track),
            unplayable: part ? undefined : true,
            albumGain: parseNumber(stream?.albumGain),
            albumPeak: parseNumber(stream?.albumPeak),
            trackGain: parseNumber(stream?.gain),
            trackPeak: parseNumber(stream?.peak),
            bitRate: media.bitrate,
            badge: media.audioCodec,
            explicit: track.contentRating === 'explicit',
        };
    }

    private createMediaAlbum(album: plex.Album, noPager?: boolean): MediaAlbum {
        const mediaAlbum = {
            src: this.getSrc('album', album),
            itemType: ItemType.Album,
            externalUrl: this.getExternalUrl(album),
            title: album.title || '',
            description: album.summary,
            addedAt: album.addedAt,
            artist: album.parentTitle,
            rating: this.getRating(album.userRating),
            globalRating: this.getRating(album.rating),
            year: album.year,
            playedAt: album.lastViewedAt,
            playCount: album.viewCount,
            genres: this.getGenres(album),
            thumbnails: this.createThumbnails(album.thumb || album.parentThumb),
            release_mbid: this.getMbid(album),
        };
        if (!noPager) {
            (mediaAlbum as any).pager = this.createPager({path: album.key});
        }
        return mediaAlbum as MediaAlbum;
    }

    private createMediaArtist(artist: plex.Artist, noPager?: boolean): MediaArtist {
        const mediaArtist = {
            src: this.getSrc('artist', artist),
            itemType: ItemType.Artist,
            externalUrl: this.getExternalUrl(artist),
            title: artist.title,
            description: artist.summary,
            country: artist.Country?.map((country) => country.tag).join(', '),
            addedAt: artist.addedAt,
            rating: this.getRating(artist.userRating),
            globalRating: this.getRating(artist.rating),
            genres: this.getGenres(artist),
            thumbnails: this.createThumbnails(artist.thumb),
            artist_mbid: this.getMbid(artist),
        };
        if (!noPager) {
            (mediaArtist as any).pager = this.createArtistAlbumsPager(artist);
        }
        return mediaArtist as MediaArtist;
    }

    private createMediaItemFromVideo(video: plex.MusicVideo): MediaItem {
        const media = video.Media?.[0];
        const part = media?.Part?.[0];

        return {
            src: this.getSrc('video', video),
            srcs: video.Media?.map(({Part: [part]}) => part.key),
            itemType: ItemType.Media,
            mediaType: MediaType.Video,
            externalUrl: this.getExternalUrl(video),
            fileName: this.getFileName(part?.file),
            title: video.title || 'Video',
            addedAt: video.addedAt,
            artists: video.grandparentTitle ? [video.grandparentTitle] : undefined,
            duration: video.duration / 1000,
            playedAt: video.lastViewedAt || 0,
            playCount: video.viewCount,
            genres: this.getGenres(video),
            thumbnails: this.createThumbnails(video.thumb),
            unplayable: part ? undefined : true,
            bitRate: media.bitrate,
            badge: media.videoResolution,
            aspectRatio: media.aspectRatio,
            explicit: video.contentRating === 'explicit',
        };
    }

    private createMediaPlaylist(playlist: plex.Playlist, noPager?: boolean): MediaPlaylist {
        const src = this.getSrc('playlist', playlist);
        const mediaPlaylist = {
            src,
            itemType: ItemType.Playlist,
            externalUrl: this.getExternalUrl(playlist),
            title: playlist.title,
            description: playlist.summary,
            addedAt: playlist.addedAt,
            duration: playlist.duration / 1000,
            playedAt: playlist.lastViewedAt,
            playCount: playlist.viewCount,
            trackCount: playlist.leafCount,
            thumbnails: this.createThumbnails(playlist.thumb || playlist.composite),
            isPinned: pinStore.isPinned(src),
        };
        if (!noPager) {
            (mediaPlaylist as any).pager = this.createPager({path: playlist.key});
        }
        return mediaPlaylist as MediaPlaylist;
    }

    private createMediaFolder(folder: plex.Folder): MediaFolder {
        const mediaFolder: Writable<SetOptional<MediaFolder, 'pager'>> = {
            itemType: ItemType.Folder,
            src: `plex:folder:${folder.key}`,
            title: folder.title,
            fileName: folder.title,
            path:
                this.parent?.itemType === ItemType.Folder
                    ? `${this.parent.path}/${folder.title}`
                    : '/',
            parent: this.parent as ParentOf<MediaFolder>,
        };
        mediaFolder.pager = this.createFolderPager(mediaFolder as MediaFolder);
        return mediaFolder as MediaFolder;
    }

    private getExternalUrl(object: plex.MediaObject): string {
        const host = 'https://app.plex.tv/desktop/#!';
        const clientIdentifier = plexSettings.server?.clientIdentifier;
        const webHost = clientIdentifier ? `${host}/server/${clientIdentifier}` : '';
        let path = 'details';
        let key = `/library/metadata/${object.ratingKey}`;

        switch (object.type) {
            case plexItemType.Clip:
                key = object.art?.replace(/\/art\/\d+$/, '');
                break;

            case plexItemType.Playlist:
                key = `/playlists/${object.ratingKey}`;
                path = 'playlist';
                break;

            case plexItemType.Track: {
                const parentRatingKey = object.parentRatingKey;
                key = parentRatingKey ? `/library/metadata/${parentRatingKey}` : '';
                break;
            }
        }
        return webHost && key ? `${webHost}/${path}?key=${encodeURIComponent(key)}` : '';
    }

    private getFileName(path = ''): string | undefined {
        return path.split(/[/\\]/).pop();
    }

    private getGenres(object: plex.RatingObject): string[] | undefined {
        return object.Genre?.map((genre) => genre.tag);
    }

    private getMbid(object: plex.RatingObject): string | undefined {
        const guids = object.Guid;
        if (guids) {
            const id = guids.map((guid) => guid.id).find((id) => id.startsWith('mbid://'));
            return id?.replace('mbid://', '');
        }
    }

    private async getPlexAlbums(
        items: readonly plex.MediaObject[]
    ): Promise<readonly plex.Album[]> {
        const isTrack = (object: plex.MediaObject): object is plex.Track => object.type === 'track';
        const tracks = items.filter(isTrack);
        const albumKeys = uniq(tracks.map((track) => track.parentRatingKey));
        if (albumKeys.length > 0) {
            return plexApi.getMetadata<plex.Album>(albumKeys);
        }
        return [];
    }

    private getRating(rating: number | undefined): number | undefined {
        return typeof rating === 'number' ? Math.round((rating || 0) / 2) : undefined;
    }

    private getSrc(type: string, object: plex.MediaObject): string {
        return `plex:${type}:${object.ratingKey}`;
    }

    private createThumbnails(thumb: string): Thumbnail[] | undefined {
        return thumb
            ? [
                  this.createThumbnail(thumb, 240),
                  this.createThumbnail(thumb, 360),
                  this.createThumbnail(thumb, 480),
                  this.createThumbnail(thumb, 800),
              ]
            : undefined;
    }

    private createThumbnail(thumb: string, width: number, height = width): Thumbnail {
        const url = `${plexSettings.host}/photo/:/transcode?url=${encodeURIComponent(
            thumb
        )}&width=${width}&height=${height}&minSize=1&upscale=1&X-Plex-Token={plex-token}`; // not a typo
        return {url, width, height};
    }

    private createFolderPager(folder: MediaFolder): Pager<MediaFolderItem> {
        const [, , key] = folder.src.split(':');
        const folderPager = this.createPager<MediaFolderItem>(
            {path: key},
            {pageSize: this.pageSize},
            folder
        );
        if (this.parent?.itemType === ItemType.Folder) {
            const parentFolder: MediaFolderItem = {
                ...this.parent,
                fileName: `../${this.parent.fileName}`,
            };
            const backPager = new SimplePager([parentFolder]);
            return new WrappedPager<MediaFolderItem>(backPager, folderPager);
        } else {
            return folderPager;
        }
    }

    private createArtistAlbumsPager(artist: plex.Artist): Pager<MediaAlbum> {
        const albumsPager = this.createPager<MediaAlbum>({
            path: getMusicLibraryPath(),
            params: {
                'artist.id': artist.ratingKey,
                type: plexMediaType.Album,
                sort: 'year:desc,originallyAvailableAt:desc,artist.titleSort:desc,album.titleSort,album.index',
            },
        });
        const videos = this.createArtistVideos(artist);
        const topPager = new SimpleMediaPager<MediaAlbum>(async () => {
            try {
                const items = await fetchFirstPage(videos.pager, {keepAlive: true});
                return items.length === 0 ? [] : [videos];
            } catch (err) {
                logger.error(err);
                return [];
            }
        });
        const otherTracks = this.createArtistOtherTracks(artist);
        const otherTracksPager = new SimplePager<MediaAlbum>([otherTracks]);
        return new WrappedPager(topPager, albumsPager, otherTracksPager);
    }

    private createArtistOtherTracks(artist: plex.Artist): MediaAlbum {
        return {
            itemType: ItemType.Album,
            src: this.getSrc('other-tracks', artist),
            title: 'Other Tracks',
            artist: artist.title,
            thumbnails: this.createThumbnails(artist.thumb),
            pager: this.createOtherTracksPager(artist),
            synthetic: true,
        };
    }

    private createArtistVideos(artist: plex.Artist): MediaAlbum {
        return {
            itemType: ItemType.Album,
            src: this.getSrc('videos', artist),
            title: 'Music Videos',
            artist: artist.title,
            thumbnails: this.createThumbnails(artist.thumb),
            pager: this.createVideosPager(artist),
            synthetic: true,
        };
    }

    private createOtherTracksPager(artist: plex.Artist): Pager<MediaItem> {
        return this.createPager({
            params: {
                originalTitle: artist.title,
                type: plexMediaType.Track,
            },
        });
    }

    private createVideosPager(artist: plex.Artist): Pager<MediaItem> {
        return this.createPager({path: `/library/metadata/${artist.ratingKey}/extras`});
    }

    private createPager<T extends MediaObject>(
        request: Partial<PlexRequest>,
        options?: Partial<PagerConfig>,
        parent?: ParentOf<T>
    ): Pager<T> {
        return new PlexPager(
            {
                ...this.request,
                params: undefined,
                ...request,
            },
            options,
            parent
        );
    }
}

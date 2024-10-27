import React, {useMemo} from 'react';
import Action from 'types/Action';
import ItemType from 'types/ItemType';
import MediaAlbum from 'types/MediaAlbum';
import MediaFolderItem from 'types/MediaFolderItem';
import MediaItem from 'types/MediaItem';
import MediaObject from 'types/MediaObject';
import MediaPlaylist from 'types/MediaPlaylist';
import MediaSourceLayout, {Field} from 'types/MediaSourceLayout';
import MediaType from 'types/MediaType';
import {getServiceFromSrc} from 'services/mediaServices';
import {performAction} from 'components/Actions';
import {ColumnSpec, ListViewLayout} from 'components/ListView';
import Actions from 'components/Actions';
import {ExplicitBadge} from 'components/Badges/Badge';
import CoverArt from 'components/CoverArt';
import Icon from 'components/Icon';
import MediaSourceLabel from 'components/MediaSources/MediaSourceLabel';
import StarRating from 'components/StarRating';
import SunClock from 'components/SunClock';
import Time from 'components/Time';

const defaultLayout: MediaSourceLayout<MediaObject> = {
    view: 'details',
    fields: ['Title', 'Genre', 'Owner'],
};

export default function useMediaListLayout<T extends MediaObject = MediaObject>(
    layout: MediaSourceLayout<T> = defaultLayout
): ListViewLayout<T> {
    return useMemo(() => createMediaListLayout(layout), [layout]);
}

function createMediaListLayout<T extends MediaObject = MediaObject>(
    layout: MediaSourceLayout<T>
): ListViewLayout<T> {
    if (layout.view === 'none') {
        return {view: 'details', cols: []};
    }
    const {view, fields} = layout;
    const cols = fields.map((field) => mediaFields[field]);
    cols.push({
        id: '...',
        title: <Icon name="menu" />,
        render: (item: T) => <Actions item={item} inline />,
        className: 'actions',
        align: 'right',
        width: 5,
    });
    if (view === 'details') {
        return {view, cols, showTitles: true, sizeable: true};
    } else {
        return {view, cols};
    }
}

type MediaFields<T extends MediaObject = MediaObject> = Record<Field, ColumnSpec<T>>;
type RenderField<T extends MediaObject = MediaObject> = ColumnSpec<T>['render'];

const Index: RenderField = (_, rowIndex) => <Text value={rowIndex + 1} />;

const Title: RenderField = (item) => {
    return (
        <span className="text">
            {item.itemType === ItemType.Media || item.itemType === ItemType.Album ? (
                <>
                    <span className="title-text">{item.title}</span> <ExplicitBadge item={item} />
                </>
            ) : (
                item.title
            )}
        </span>
    );
};

const PlaylistTitle: RenderField = (item) => {
    const service = getServiceFromSrc(item);
    return service ? (
        <MediaSourceLabel icon={service.icon} text={item.title} />
    ) : (
        <Text value={item.title} />
    );
};

const Blurb: RenderField<MediaPlaylist> = (item) => <Text value={item.description} />;

const Track: RenderField<MediaItem> = (item) => <Text value={item.track || '-'} />;

const AlbumTrack: RenderField<MediaItem> = (item) => (
    <span className="text">
        {item.track ? (
            <>
                <span className="disc">{item.disc || '?'}.</span>
                {item.track}
            </>
        ) : (
            '-'
        )}
    </span>
);

const Artist: RenderField<MediaAlbum | MediaItem> = (item) => (
    <Text value={item.itemType === ItemType.Media ? item.artists?.join(', ') : item.artist} />
);

const AlbumArtist: RenderField<MediaItem> = (item) => <Text value={item.albumArtist} />;

const Album: RenderField<MediaItem> = (item) => <Text value={item.album} />;

const Duration: RenderField<MediaPlaylist | MediaItem> = (item) => (
    <Time className="text" time={item.duration || 0} />
);

const PlayCount: RenderField<MediaPlaylist | MediaAlbum | MediaItem> = (item) => (
    <Text value={getCount(item.playCount)} />
);

const TrackCount: RenderField<MediaPlaylist | MediaAlbum> = (item) => (
    <Text value={getCount(item.trackCount)} />
);

const Year: RenderField<MediaAlbum | MediaItem> = (item) => <Text value={item.year || ''} />;

const Genre: RenderField<MediaPlaylist | MediaAlbum | MediaItem> = (item) => (
    <Text value={item.genres?.join(', ')} />
);

const Owner: RenderField<MediaPlaylist | MediaItem> = (item) => <Text value={item.owner?.name} />;

const FileName: RenderField<MediaFolderItem> = (item) => <Text value={item.fileName} />;

const Views: RenderField = (item) => {
    if (item.globalPlayCount == null) {
        return null;
    }
    return <Text value={getGlobalPlayCount(item.globalPlayCount, 'view')} />;
};

const LastPlayed: RenderField<MediaPlaylist | MediaAlbum | MediaItem> = (item) => {
    if (!item.playedAt) {
        return <span className="text last-played">unplayed</span>;
    }
    const date = new Date(item.playedAt * 1000);
    const elapsedTime = getElapsedTimeText(date.valueOf());
    return (
        <time className="text last-played" title={date.toLocaleString()}>
            {elapsedTime}
        </time>
    );
};

const AddedAt: RenderField<MediaPlaylist | MediaAlbum | MediaItem> = (item) => {
    if (!item.addedAt) {
        return null;
    }
    const date = new Date(item.addedAt * 1000);
    const elapsedTime = getElapsedTimeText(date.valueOf());
    return (
        <time className="text added-at" title={date.toLocaleString()}>
            {elapsedTime}
        </time>
    );
};

const ListenDate: RenderField<MediaPlaylist | MediaAlbum | MediaItem> = (item) => {
    if (!item.playedAt) {
        return '';
    }
    const time = item.playedAt * 1000;
    const date = new Date(time);
    return (
        <time className="text" title={date.toLocaleString()}>
            <SunClock time={time} />
            <span className="date">{date.toLocaleDateString()}</span>
        </time>
    );
};

const AlbumAndYear: RenderField<MediaItem> = (item) => (
    <Text
        value={item.album ? (item.year ? `${item.album} (${item.year})` : item.album) : item.year}
    />
);

const FileIcon: RenderField<MediaFolderItem> = (item: MediaFolderItem, rowIndex: number) => {
    const icon =
        item.itemType === ItemType.Media
            ? item.mediaType === MediaType.Video
                ? 'file-video'
                : 'file-audio'
            : rowIndex === 0 && item.fileName.startsWith('../')
            ? 'folder-up'
            : 'folder';
    return (
        <figure className="cover-art">
            <Icon className="cover-art-image" name={icon} />
        </figure>
    );
};

const Thumbnail: RenderField = (item) => {
    return <CoverArt item={item} />;
};

const Rate: RenderField = (item) => {
    return (
        <StarRating
            value={item.rating}
            tabIndex={-1}
            onChange={async (rating: number) => {
                await performAction(Action.Rate, [item], rating);
            }}
        />
    );
};

function Text({value = ''}: {value?: string | number}) {
    return value === '' ? null : <span className="text">{value}</span>;
}

// TODO: Improve typing.
const mediaFields: MediaFields<any> = {
    Index: {id: '#', title: '#', render: Index, className: 'index', align: 'right', width: 4},
    Artist: {id: 'artist', title: 'Artist', render: Artist, className: 'artist'},
    AlbumArtist: {
        id: 'albumArtist',
        title: 'Album Artist',
        render: AlbumArtist,
        className: 'artist',
    },
    AlbumTrack: {
        id: '#',
        title: '#',
        render: AlbumTrack,
        align: 'right',
        width: 4,
        className: 'index',
    },
    Title: {id: 'title', title: 'Title', render: Title, className: 'title'},
    PlaylistTitle: {id: 'title', title: 'Title', render: PlaylistTitle, className: 'title'},
    Blurb: {id: 'blurb', title: 'Description', render: Blurb, className: 'blurb'},
    Album: {id: 'album', title: 'Album', render: Album, className: 'album'},
    AlbumAndYear: {id: 'albumAndYear', title: 'Album', render: AlbumAndYear, className: 'album'},
    Track: {
        id: 'track',
        title: 'Track',
        render: Track,
        align: 'right',
        width: 5,
        className: 'track',
    },
    Duration: {
        id: 'duration',
        title: 'Time',
        render: Duration,
        align: 'right',
        width: 8,
        className: 'duration',
    },
    FileIcon: {id: 'fileIcon', title: 'Thumbnail', render: FileIcon, className: 'thumbnail'},
    FileName: {id: 'fileName', title: 'FileName', render: FileName, className: 'title'},
    PlayCount: {
        id: 'playCount',
        title: 'Plays',
        render: PlayCount,
        align: 'right',
        width: 5,
        className: 'play-count',
    },
    TrackCount: {
        id: 'trackCount',
        title: 'Tracks',
        render: TrackCount,
        align: 'right',
        width: 8,
        className: 'track-count',
    },
    Year: {id: 'year', title: 'Year', render: Year, width: 8, className: 'year'},
    Views: {id: 'views', title: 'Views', render: Views, className: 'views'},
    Genre: {id: 'genre', title: 'Genre', render: Genre, className: 'genre'},
    Owner: {id: 'owner', title: 'Owner', render: Owner, className: 'owner'},
    AddedAt: {id: 'addedAt', title: 'Date Added', render: AddedAt, className: 'added-at'},
    LastPlayed: {
        id: 'lastPlayed',
        title: 'Last played',
        render: LastPlayed,
        className: 'played-at',
    },
    ListenDate: {
        id: 'listenDate',
        title: 'Played On',
        render: ListenDate,
        className: 'played-at listen-date',
    },
    Thumbnail: {id: 'thumbnail', title: 'Thumbnail', render: Thumbnail, className: 'thumbnail'},
    Rate: {
        id: 'rate',
        title: <StarRating value={0} tabIndex={-1} />,
        render: Rate,
        align: 'right',
        width: 8,
        className: 'rate',
    },
};

function getCount(count?: number): string {
    if (count == null) {
        return '';
    }
    const value = Number(count);
    return isNaN(value) ? '' : value.toLocaleString();
}

function getElapsedTimeText(playedAt: number): string {
    const elapsedTime = Date.now() - playedAt;
    const minute = 60_000;
    if (elapsedTime < minute * 2) {
        return 'just now';
    }
    const hour = 60 * minute;
    if (elapsedTime < hour * 1.5) {
        return `${Math.round(elapsedTime / minute)} mins ago`;
    }
    const day = 24 * hour;
    if (elapsedTime < day * 1.5) {
        return `${Math.round(elapsedTime / hour)} hours ago`;
    }
    if (elapsedTime < day * 12) {
        return `${Math.round(elapsedTime / day)} days ago`;
    }
    const week = 7 * day;
    if (elapsedTime < week * 10) {
        return `${Math.round(elapsedTime / week)} weeks ago`;
    }
    const month = 30 * day;
    const year = 365 * day;
    if (elapsedTime < year) {
        return `${Math.round(elapsedTime / month)} months ago`;
    }
    if (elapsedTime < 2 * year) {
        return `1 year ago`;
    }
    return `${Math.floor(elapsedTime / year)} years ago`;
}

function getGlobalPlayCount(
    globalPlayCount = 0,
    countName = 'listen',
    countNamePlural = countName + 's'
): string {
    if (globalPlayCount === 1) {
        return `1 ${countName}`;
    } else if (globalPlayCount < 1_000) {
        return `${globalPlayCount} ${countNamePlural}`;
    } else if (globalPlayCount < 100_000) {
        return `${(globalPlayCount / 1000).toFixed(1).replace('.0', '')}K  ${countNamePlural}`;
    } else if (globalPlayCount < 1_000_000) {
        return `${Math.round(globalPlayCount / 1000)}K  ${countNamePlural}`;
    } else if (globalPlayCount < 100_000_000) {
        return `${(globalPlayCount / 1_000_000).toFixed(1).replace('.0', '')}M  ${countNamePlural}`;
    } else if (globalPlayCount < 1_000_000_000) {
        return `${Math.round(globalPlayCount / 1_000_000)}M  ${countNamePlural}`;
    } else {
        return `${(globalPlayCount / 1_000_000_000)
            .toFixed(1)
            .replace('.0', '')}B  ${countNamePlural}`;
    }
}

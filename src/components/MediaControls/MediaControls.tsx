import React, {useCallback, useEffect, useRef, useState} from 'react';
import {skip} from 'rxjs';
import {MAX_DURATION} from 'services/constants';
import mediaPlayback, {pause, play, seek, stop} from 'services/mediaPlayback';
import {observeCurrentTime, observeDuration} from 'services/mediaPlayback/playback';
import {observeCurrentIndex} from 'services/playlist';
import {ListViewHandle} from 'components/ListView';
import Time from 'components/Time';
import usePlaylistInject from 'components/Playlist/usePlaylistInject';
import useObservable from 'hooks/useObservable';
import usePaused from 'hooks/usePaused';
import useThrottledValue from 'hooks/useThrottledValue';
import MediaButton from './MediaButton';
import VolumeControl from './VolumeControl';
import usePlaylistMenu from './usePlaylistMenu';
import './MediaControls.scss';

export interface MediaControlsProps {
    listViewRef: React.MutableRefObject<ListViewHandle | null>;
}

export default function MediaControls({listViewRef}: MediaControlsProps) {
    const playheadRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const currentIndex = useObservable(observeCurrentIndex, -1);
    const currentTime = useObservable(observeCurrentTime, 0);
    const duration = useObservable(observeDuration, 0);
    const isLiveStreaming = duration === MAX_DURATION;
    const paused = usePaused();
    const {showPlaylistMenu} = usePlaylistMenu(listViewRef, fileRef);
    const inject = usePlaylistInject();
    const [seekTime, setSeekTime] = useThrottledValue(0, 300, {trailing: true});
    const [seeking, setSeeking] = useState(false);

    useEffect(() => {
        if (!seeking) {
            const subscription = observeCurrentTime()
                .pipe(skip(1))
                .subscribe(
                    (currentTime) =>
                        (playheadRef.current!.valueAsNumber = isLiveStreaming
                            ? currentTime && 1
                            : currentTime)
                );
            return () => subscription.unsubscribe();
        }
    }, [isLiveStreaming, seeking]);

    useEffect(() => {
        seek(seekTime);
    }, [seekTime]);

    const handleSeekChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setSeeking(true);
            setSeekTime(event.target.valueAsNumber);
        },
        [setSeekTime]
    );

    const stopSeeking = useCallback(() => setSeeking(false), []);

    const handleMenuClick = useCallback(
        async (event: React.MouseEvent<HTMLButtonElement>) => {
            const {right, bottom} = (event.target as HTMLButtonElement).getBoundingClientRect();
            await showPlaylistMenu(right, bottom + 4);
        },
        [showPlaylistMenu]
    );

    const handlePrevClick = useCallback(async () => {
        mediaPlayback.prev();
        listViewRef.current?.scrollIntoView(currentIndex - 1);
        listViewRef.current?.focus();
    }, [listViewRef, currentIndex]);

    const handleNextClick = useCallback(async () => {
        mediaPlayback.next();
        listViewRef.current?.scrollIntoView(currentIndex + 1);
        listViewRef.current?.focus();
    }, [listViewRef, currentIndex]);

    const handleFileImport = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target!.files;
            if (files) {
                await inject.files(files, -1);
                event.target!.value = '';
            }
        },
        [inject]
    );

    return (
        <div className="media-controls">
            <div className="current-time-control">
                <Time time={currentTime} />
                <input
                    id="playhead"
                    type="range"
                    aria-label="Seek"
                    min={0}
                    max={isLiveStreaming ? 1 : duration}
                    step={1}
                    disabled={paused || isLiveStreaming}
                    onChange={handleSeekChange}
                    onMouseUp={stopSeeking}
                    onKeyUp={stopSeeking}
                    ref={playheadRef}
                />
            </div>
            <div className="playback-control">
                <VolumeControl />
                <div className="media-buttons">
                    <MediaButton
                        aria-label="Previous track"
                        icon="prev"
                        onClick={handlePrevClick}
                    />
                    <MediaButton
                        aria-label={paused ? 'Play' : 'Pause'}
                        icon={paused ? 'play' : 'pause'}
                        onClick={paused ? play : pause}
                    />
                    <MediaButton aria-label="Stop" icon="stop" onClick={stop} />
                    <MediaButton aria-label="Next track" icon="next" onClick={handleNextClick} />
                </div>
                <div className="media-buttons-menu">
                    <MediaButton title="More…" icon="menu" onClick={handleMenuClick} />
                    <input
                        type="file"
                        accept="audio/*,video/*"
                        multiple
                        onChange={handleFileImport}
                        ref={fileRef}
                    />
                </div>
            </div>
        </div>
    );
}

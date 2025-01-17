import type {Observable} from 'rxjs';
import {
    EMPTY,
    BehaviorSubject,
    Subject,
    catchError,
    distinctUntilChanged,
    filter,
    mergeMap,
    of,
    skipWhile,
    switchMap,
    take,
    tap,
} from 'rxjs';
import PlayableItem from 'types/PlayableItem';
import Player from 'types/Player';
import audio from 'services/audio';
import {observeIsLoggedIn, waitForLogin} from 'services/mediaServices';
import {Logger} from 'utils';

const logger = new Logger('MusicKitPlayer');

export class MusicKitPlayer implements Player<PlayableItem> {
    private player?: MusicKit.MusicKitInstance;
    private readonly paused$ = new BehaviorSubject(true);
    private readonly duration$ = new Subject<number>();
    private readonly currentTime$ = new Subject<number>();
    private readonly ended$ = new Subject<void>();
    private readonly playing$ = new Subject<void>();
    private readonly error$ = new Subject<unknown>();
    private readonly element: HTMLElement;
    private readonly item$ = new BehaviorSubject<PlayableItem | null>(null);
    private loadedSrc = '';
    private hasWaited = false;
    private ended = false;
    private loading = false;
    private stopped = false;
    autoplay = false;
    loop = false;
    #muted = true;
    #volume = 1;

    constructor() {
        const element = (this.element = document.createElement('div'));
        element.hidden = true;
        element.className = 'apple-video';
        element.id = 'apple-music-video-container';

        // Load new tracks.
        this.observePaused()
            .pipe(
                switchMap((paused) => (paused ? EMPTY : this.observeItem())),
                switchMap((item) => {
                    if (item && item.src !== this.loadedSrc) {
                        return of(undefined).pipe(
                            mergeMap(() => this.createPlayer()),
                            mergeMap(() => this.loadAndPlay(item)),
                            catchError((error) => {
                                this.loadedSrc = '';
                                this.error$.next(error);
                                return EMPTY;
                            }),
                            take(1)
                        );
                    } else {
                        return EMPTY;
                    }
                })
            )
            .subscribe(logger);

        // Stop and emit an error on logout.
        // The media player will only emit the error if this player is the current player.
        observeIsLoggedIn('apple')
            .pipe(
                skipWhile((isLoggedIn) => !isLoggedIn),
                filter((isLoggedIn) => !isLoggedIn),
                mergeMap(() => this.unload()),
                tap(() => this.error$.next(Error('Not logged in')))
            )
            .subscribe(logger);

        this.observePlaying().subscribe(() => (this.ended = false));
        this.observeEnded().subscribe(() => (this.ended = true));

        // Log errors.
        this.observeError().subscribe(logger.error);
    }

    get hidden(): boolean {
        return this.element.hidden;
    }

    set hidden(hidden: boolean) {
        this.element.hidden = hidden;
    }

    get muted(): boolean {
        return this.#muted;
    }

    set muted(muted: boolean) {
        this.#muted = muted;
        this.synchVolume();
    }

    get volume(): number {
        return this.#volume;
    }

    set volume(volume: number) {
        this.#volume = volume;
        this.synchVolume();
    }

    observeCurrentTime(): Observable<number> {
        return this.currentTime$.pipe(
            distinctUntilChanged(),
            filter(() => this.player?.playbackState !== MusicKit.PlaybackStates.seeking)
        );
    }

    observeDuration(): Observable<number> {
        return this.duration$.pipe(distinctUntilChanged());
    }

    observePlaying(): Observable<void> {
        return this.playing$;
    }

    observeEnded(): Observable<void> {
        return this.ended$;
    }

    observeError(): Observable<unknown> {
        return this.error$;
    }

    appendTo(parentElement: HTMLElement): void {
        parentElement.appendChild(this.element);
    }

    load(item: PlayableItem): void {
        logger.log('load', item.src);
        if (this.autoplay) {
            this.stopped = false;
        }
        this.item$.next(item);
        this.paused$.next(!this.autoplay);
        if (item.src === this.loadedSrc) {
            this.safeReload(item);
        }
    }

    play(): void {
        logger.log('play');
        this.stopped = false;
        this.paused$.next(false);
        if (this.src === this.loadedSrc) {
            this.safePlay();
        }
    }

    pause(): void {
        logger.log('pause');
        this.paused$.next(true);
        this.safePause();
    }

    stop(): void {
        logger.log('stop');
        this.stopped = true;
        this.paused$.next(true);
        if (this.item?.startTime) {
            this.item$.next({...this.item, startTime: 0});
        }
        this.safeStop();
    }

    seek(time: number): void {
        this.player?.seekToTime(time);
    }

    resize(width: number, height: number): void {
        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
    }

    private get item(): PlayableItem | null {
        return this.item$.value;
    }

    private get paused(): boolean {
        return this.paused$.value;
    }

    private get src(): string | undefined {
        return this.item?.src;
    }

    private observeItem(): Observable<PlayableItem | null> {
        return this.item$.pipe(distinctUntilChanged());
    }

    private observePaused(): Observable<boolean> {
        return this.paused$.pipe(distinctUntilChanged());
    }

    private async createPlayer(): Promise<void> {
        if (!this.player) {
            const isLoggedIn = await this.waitForLogin();
            if (isLoggedIn) {
                const player = (this.player = MusicKit.getInstance());
                const Events = MusicKit.Events;

                this.synchVolume();

                player.addEventListener(Events.playbackStateDidChange, this.onPlaybackStateChange);
                player.addEventListener(Events.playbackDurationDidChange, this.onDurationChange);
                player.addEventListener(Events.playbackTimeDidChange, this.onTimeChange);
                player.addEventListener(Events.mediaPlaybackError, this.onError);
            } else {
                throw Error('Not logged in');
            }
        }
    }

    private async loadAndPlay(item: PlayableItem): Promise<void> {
        if (this.paused) {
            return;
        }

        if (!this.player?.isAuthorized) {
            throw Error('Not logged in');
        }

        const {src, startTime = 0} = item;
        const [, type, id] = src.split(':');

        // "(library-)?music-videos" => "musicVideo"
        const kind = type
            .replace('library-', '')
            .replace(/s$/, '')
            .replace(/-([a-z])/g, (_, char) => char.toUpperCase());

        this.loading = true;
        await this.player.setQueue({[kind]: id, startTime, startPlaying: true});
        this.loading = false;
        this.loadedSrc = item.src;

        try {
            if (this.paused) {
                // Pause/stop button clicked during the play request.
                if (this.stopped) {
                    await this.player.stop();
                } else {
                    await this.player.pause();
                }
            } else {
                this.playing$.next();
            }
        } catch (err) {
            if (!this.paused) {
                throw err;
            }
        }
    }

    private async safePause(): Promise<void> {
        try {
            if (this.player) {
                if (this.player.playbackState !== MusicKit.PlaybackStates.paused) {
                    await this.player.pause();
                }
            }
        } catch (err) {
            logger.error(err);
        }
    }

    private async safePlay(): Promise<void> {
        try {
            if (this.player) {
                if (!this.player.isPlaying) {
                    await this.player.play();
                    if (this.paused) {
                        // Pause/stop button clicked during the play request.
                        if (this.stopped) {
                            await this.player.stop();
                        } else {
                            await this.player.pause();
                        }
                    } else {
                        this.playing$.next();
                    }
                }
            }
        } catch (err) {
            if (!this.paused) {
                this.error$.next(err);
            }
        }
    }

    protected async safeReload(item: PlayableItem): Promise<void> {
        try {
            await this.player?.seekToTime(item.startTime || 0);
        } catch (err) {
            logger.error(err);
        }
        if (this.autoplay) {
            await this.safePlay();
        }
    }

    private async safeStop(): Promise<void> {
        try {
            if (this.player) {
                if (this.player.playbackState !== MusicKit.PlaybackStates.stopped) {
                    await this.player.stop();
                }
            }
        } catch (err) {
            logger.error(err);
        }
    }

    private synchVolume(): void {
        if (this.player && this.src) {
            const [, type] = this.src.split(':');
            this.player.volume =
                // Audio volume is handled by a `GainNode`.
                !audio.streamingSupported || /video/i.test(type)
                    ? this.muted
                        ? 0
                        : this.volume
                    : 1;
        }
    }

    private async unload(): Promise<void> {
        try {
            await this.safeStop();
            await this.player?.setQueue({});
            this.loadedSrc = '';
        } catch (err) {
            logger.error(err);
        }
    }

    private async waitForLogin(): Promise<boolean> {
        const waitTime = this.hasWaited ? 0 : 3000; // Only wait once.
        const isLoggedIn = await waitForLogin('apple', waitTime);
        this.hasWaited = true;
        return isLoggedIn;
    }

    // The MusicKit typings for these callbacks are a bit lacking so they are all `any` for now.

    private readonly onPlaybackStateChange: any = async ({
        state,
    }: {
        state: MusicKit.PlaybackStates;
    }) => {
        switch (state) {
            case MusicKit.PlaybackStates.playing: {
                const [, , id] = this.src?.split(':') ?? [];
                const nowPlayingItem = this.player!.nowPlayingItem;
                if (nowPlayingItem?.isPlayable === false && nowPlayingItem.id === id) {
                    // Apple Music plays 30 seconds of silence for unplayable tracks.
                    this.error$.next(Error('Unplayable'));
                    this.stop();
                }
                // We can't emit the `playing` event here.
                // It causes problems in Firefox (possibly related to DRM and visualizers).
                // Emitting the event after a successful call to `player.play()` works just as well.
                break;
            }
            case MusicKit.PlaybackStates.ended:
            case MusicKit.PlaybackStates.completed:
                if (!this.ended && !this.loading) {
                    this.ended$.next();
                }
                break;
        }
    };

    private readonly onDurationChange: any = ({duration}: {duration: number}) => {
        this.duration$.next(duration);
    };

    private readonly onTimeChange: any = ({currentPlaybackTime}: {currentPlaybackTime: number}) => {
        const playbackState = this.player?.playbackState || 0;
        // Skip the playback states that always emit zero.
        if (playbackState && playbackState !== MusicKit.PlaybackStates.stopped) {
            this.currentTime$.next(currentPlaybackTime);
        }
    };

    private readonly onError: any = (err: any) => {
        this.error$.next(err);
    };
}

export default new MusicKitPlayer();

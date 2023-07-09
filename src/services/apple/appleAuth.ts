import type {Observable} from 'rxjs';
import {
    BehaviorSubject,
    distinctUntilChanged,
    filter,
    from,
    mergeMap,
    skipWhile,
    take,
    tap,
} from 'rxjs';
import {am_dev_token} from 'services/credentials';
import {loadScript, Logger} from 'utils';
import appleSettings from './appleSettings';
import MusicKitV1Wrapper from './MusicKitV1Wrapper';

const logger = new Logger('appleAuth');

const isLoggedIn$ = new BehaviorSubject(false);

export function isLoggedIn(): boolean {
    return isLoggedIn$.getValue();
}

export function observeIsLoggedIn(): Observable<boolean> {
    return isLoggedIn$.pipe(distinctUntilChanged());
}

export async function login(): Promise<void> {
    if (!isLoggedIn()) {
        logger.log('connect');
        try {
            const musicKit = MusicKit.getInstance(); // let this throw
            await musicKit.authorize();
            isLoggedIn$.next(musicKit.isAuthorized);
        } catch (err) {
            logger.error(err);
        }
    }
}

export async function logout(): Promise<void> {
    logger.log('disconnect');
    const musicKit = await getMusicKitInstance();
    try {
        if (musicKit.isPlaying) {
            musicKit.stop();
        }
        if (!musicKit.queue.isEmpty) {
            await musicKit.setQueue({});
        }
    } catch (err) {
        logger.error(err);
    }
    try {
        await musicKit.unauthorize();
    } catch (err) {
        logger.error(err);
    }
    isLoggedIn$.next(musicKit.isAuthorized);
}

export async function refreshToken(): Promise<void> {
    logger.log('refreshToken');
    // Apple Music doesn't support token refresh so we'll force a new login.
    await logout();
    throw Error(`Access token refresh is not supported.`);
}

const musicKitPromise = new Promise<MusicKit.MusicKitInstance>((resolve, reject) => {
    document.addEventListener('musickitloaded', async () => {
        logger.log(`Loaded MusicKit version`, MusicKit.version);
        // Wrap MusicKit v1.
        if (MusicKit.version.startsWith('1') && !MusicKit.isWrapper) {
            window.MusicKit = new MusicKitV1Wrapper(MusicKit) as any;
        }
        try {
            // MusicKit v3 is async but the types are still v1.
            const instance = await MusicKit.configure({
                developerToken: am_dev_token,
                app: {
                    name: __app_name__,
                    build: __app_version__,
                },
                sourceType: 8, // "WEBPLAYER"
                suppressErrorDialog: true,
            } as any);
            resolve(instance);
        } catch (error) {
            reject(error);
        }
    });
});

export async function getMusicKitInstance(): Promise<MusicKit.MusicKitInstance> {
    if (window.MusicKit) {
        return MusicKit.getInstance();
    } else {
        return new Promise((resolve, reject) => {
            const version = appleSettings.useMusicKitBeta ? 3 : 1;
            loadScript(`https://js-cdn.music.apple.com/musickit/v${version}/musickit.js`).then(
                () => musicKitPromise.then(resolve, reject),
                reject
            );
        });
    }
}

observeIsLoggedIn()
    .pipe(skipWhile((isLoggedIn) => !isLoggedIn))
    .subscribe((isLoggedIn) => (appleSettings.connectedAt = isLoggedIn ? Date.now() : 0));

observeIsLoggedIn()
    .pipe(
        filter((isLoggedIn) => isLoggedIn),
        mergeMap(() => getMusicKitInstance()),
        take(1),
        tap((musicKit) => {
            musicKit.addEventListener(MusicKit.Events.authorizationStatusDidChange, () =>
                isLoggedIn$.next(musicKit.isAuthorized)
            );
        })
    )
    .subscribe(logger);

if (appleSettings.connectedAt) {
    from(getMusicKitInstance())
        .pipe(
            filter((musicKit) => musicKit.isAuthorized),
            mergeMap((musicKit) => musicKit.authorize()),
            tap((token) => isLoggedIn$.next(!!token))
        )
        .subscribe(logger);
}

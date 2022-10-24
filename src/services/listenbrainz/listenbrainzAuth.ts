import type {Observable} from 'rxjs';
import {BehaviorSubject} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
import Auth from 'types/Auth';
import {Logger} from 'utils';
import {showListenBrainzLoginDialog} from 'components/Login/ListenBrainzLoginDialog';
import listenbrainzSettings from './listenbrainzSettings';

console.log('module::listenbrainzAuth');

const logger = new Logger('listenbrainzAuth');

const accessToken$ = new BehaviorSubject('');

export function observeAccessToken(): Observable<string> {
    return accessToken$.pipe(distinctUntilChanged());
}

function isLoggedIn(): boolean {
    return accessToken$.getValue() !== '';
}

export function observeIsLoggedIn(): Observable<boolean> {
    return observeAccessToken().pipe(
        map((token) => token !== ''),
        distinctUntilChanged()
    );
}

export async function login(): Promise<void> {
    if (!isLoggedIn()) {
        try {
            const returnValue = await showListenBrainzLoginDialog();
            if (returnValue) {
                const {userId, token} = JSON.parse(returnValue);
                listenbrainzSettings.userId = userId;
                listenbrainzSettings.token = token;
                logger.log('Access token successfully obtained.');
                accessToken$.next(token);
            }
        } catch (err) {
            logger.log('Could not obtain access token.');
            logger.error(err);
        }
    }
}

export async function logout(): Promise<void> {
    accessToken$.next('');
    listenbrainzSettings.clear();
}

const listenbrainzAuth: Auth = {
    observeIsLoggedIn,
    login,
    logout,
};

accessToken$.next(listenbrainzSettings.token);

export default listenbrainzAuth;
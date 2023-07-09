import React from 'react';
import MediaLibrary from 'components/MediaLibrary';
import MediaPlayback from 'components/MediaPlayback';
import Splitter from 'components/Splitter';
import useBrowser from 'hooks/useBrowser';
import useConnectivity from 'hooks/useConnectivity';
import usePseudoClasses from 'hooks/usePseudoClasses';
import usePreventDrop from 'hooks/usePreventDrop';
import useMediaSession from 'hooks/useMediaSession';
import useGlobalActions from 'hooks/useGlobalActions';
import DesktopWarning from './DesktopWarning';
import 'styles/layout.scss';

export default function App() {
    useBrowser();
    useConnectivity();
    usePseudoClasses();
    usePreventDrop();
    useMediaSession();
    useGlobalActions();

    return (
        <main>
            <Splitter id="main-layout" arrange="columns">
                <MediaLibrary />
                <MediaPlayback />
            </Splitter>
            <DesktopWarning />
        </main>
    );
}

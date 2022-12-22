import React, {useCallback, useRef} from 'react';
import VisualizerProviderId from 'types/VisualizerProviderId';
import visualizerSettings from 'services/visualizer/visualizerSettings';

export default function VisualizerSettingsGeneral() {
    const selectRef = useRef<HTMLSelectElement>(null);
    const provider = visualizerSettings.provider;
    const locked = !!visualizerSettings.lockedVisualizer;

    const handleSubmit = useCallback(() => {
        visualizerSettings.provider = selectRef.current!.value as VisualizerProviderId;
    }, []);

    return (
        <form className="visualizer-settings-general" method="dialog" onSubmit={handleSubmit}>
            <p>
                <label htmlFor="visualizer-provider">Provider:</label>
                <select id="visualizer-provider" defaultValue={provider} ref={selectRef}>
                    <option value="none">(none)</option>
                    <option value="">(random)</option>
                    {visualizerSettings.ambientVideoEnabled ? (
                        <option value="ambientvideo">Ambient Video</option>
                    ) : null}
                    <option value="ampshader">Ampshader</option>
                    <option value="audiomotion">AudioMotion</option>
                    <option value="milkdrop">Milkdrop</option>
                    <option value="spotifyviz">SpotifyViz</option>
                    <option value="waveform">Waveform</option>
                </select>
            </p>
            <p className="lock-status">
                {locked ? (
                    <small>
                        You need to unlock the current visualizer before changes take effect.
                    </small>
                ) : null}
            </p>
            <footer className="dialog-buttons">
                <button value="#cancel">Cancel</button>
                <button>Confirm</button>
            </footer>
        </form>
    );
}

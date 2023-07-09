import React, {useCallback, useId, useRef} from 'react';
import {isSourceVisible, setHiddenSources} from 'services/servicesSettings';
import DialogButtons from 'components/Dialog/DialogButtons';
import useObservable from 'hooks/useObservable';
import {MediaServiceSettingsProps} from './MediaServiceSettings';

export default function MediaServiceSettingsGeneral({service}: MediaServiceSettingsProps) {
    const id = useId();
    const ref = useRef<HTMLFieldSetElement>(null);
    const connected = useObservable(service.observeIsLoggedIn, false);

    const handleSubmit = useCallback(() => {
        const inputs = ref.current!.elements as HTMLInputElements;
        const settings: Record<string, boolean> = {};
        for (const input of inputs) {
            settings[input.value] = !input.checked;
        }
        setHiddenSources(settings);
    }, []);

    return (
        <form className="media-service-settings-general" method="dialog" onSubmit={handleSubmit}>
            <p>
                <button
                    type="button"
                    className="disconnect"
                    onClick={service.logout}
                    disabled={!connected}
                >
                    {connected ? 'Disconnect...' : 'Not connected'}
                </button>
            </p>
            <fieldset ref={ref}>
                <legend>Display</legend>
                <ul>
                    {service.sources.map((source) => (
                        <li key={source.id}>
                            <input
                                id={`${id}-${source.id}`}
                                type="checkbox"
                                value={source.id}
                                defaultChecked={isSourceVisible(source)}
                            />
                            <label htmlFor={`${id}-${source.id}`}>{source.title}</label>
                        </li>
                    ))}
                </ul>
            </fieldset>
            <DialogButtons />
        </form>
    );
}

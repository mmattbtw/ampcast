import React, {useCallback, useRef, useState} from 'react';
import MediaService from 'types/MediaService';
import PublicMediaService from 'types/PublicMediaService';
import ServiceType from 'types/ServiceType';
import {getService} from 'services/mediaServices';
import {allowAllServices, isSourceVisible, setHiddenSources} from 'services/servicesSettings';
import DialogButtons from 'components/Dialog/DialogButtons';
import MediaServiceList from './MediaServiceList';
import confirmDisconnectServices from './confirmDisconnectServices';

export interface MediaServicesSettingsGeneralProps {
    serviceType: ServiceType;
    services: readonly MediaService[];
}

export default function MediaServicesSettingsGeneral({
    serviceType,
    services,
}: MediaServicesSettingsGeneralProps) {
    const ref = useRef<HTMLFieldSetElement>(null);
    const isPublicMedia = serviceType === ServiceType.PublicMedia;
    const multiSelect = !isPublicMedia || allowAllServices;
    const [restrictedAccess, setRestrictedAccess] = useState(() =>
        isPublicMedia ? services.filter(isSourceVisible).some(hasRestrictedAccess) : false
    );

    const handleChange = useCallback(async () => {
        const inputs = ref.current!.elements as HTMLInputElements;
        let restrictedAccess = false;
        for (const input of inputs) {
            const serviceId = input.value;
            if (serviceId && input.checked) {
                restrictedAccess ||= hasRestrictedAccess(getService(serviceId));
            }
        }
        setRestrictedAccess(restrictedAccess);
    }, []);

    const handleSubmit = useCallback(async () => {
        const inputs = ref.current!.elements as HTMLInputElements;
        const updates: Record<string, boolean> = {};
        const disabledServices = [];
        for (const input of inputs) {
            const serviceId = input.value;
            if (serviceId) {
                const disabled = !input.checked;
                updates[serviceId] = disabled;
                const service = getService(serviceId);
                if (service && disabled) {
                    disabledServices.push(service);
                }
            }
        }
        const confirmed = await confirmDisconnectServices(disabledServices);
        if (confirmed) {
            setHiddenSources(updates);
        }
    }, []);

    return (
        <form method="dialog" onSubmit={handleSubmit}>
            <fieldset
                className="media-services"
                onChange={isPublicMedia ? handleChange : undefined}
                ref={ref}
            >
                <legend>Enable</legend>
                <MediaServiceList services={services} multiSelect={multiSelect} />
            </fieldset>
            {restrictedAccess ? (
                <p className="restricted-access">*Access is restricted.</p>
            ) : null}
            <DialogButtons />
        </form>
    );
}

function hasRestrictedAccess(service: MediaService | undefined): boolean {
    return !!(service as PublicMediaService)?.restrictedAccess;
}

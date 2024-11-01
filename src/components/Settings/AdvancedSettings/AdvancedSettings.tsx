import React from 'react';
import TabList, {TabItem} from 'components/TabList';
import Logs from './Logs';
import Troubleshooting from './Troubleshooting';
import './AdvancedSettings.scss';

const tabs: TabItem[] = [
    {
        tab: 'Logs',
        panel: <Logs />,
    },
    {
        tab: 'Troubleshooting',
        panel: <Troubleshooting />,
    },
];

export default function AdvancedSettings() {
    return <TabList className="advanced-settings" items={tabs} label="Advanced Settings" />;
}

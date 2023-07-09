import {LiteStorage} from 'utils';

const storage = new LiteStorage('youtube');

export default {
    get connectedAt(): number {
        return storage.getNumber('connectedAt');
    },

    set connectedAt(connectedAt: number) {
        storage.setNumber('connectedAt', connectedAt);
    },

    clear(): void {
        storage.clear();
    },
};

import {useLayoutEffect} from 'react';
import {fromEvent, Subscription} from 'rxjs';
import {stopPropagation} from 'utils';

export default function usePseudoClasses(): void {
    useLayoutEffect(() => {
        const app = document.getElementById('app')!;
        const system = document.getElementById('system')!;
        const subscription = new Subscription();
        const subscribe = (root: HTMLElement) =>
            fromEvent<FocusEvent>(root, 'focusin').subscribe(() => {
                const prevActiveElement = root.querySelector('.focus');
                if (prevActiveElement !== document.activeElement) {
                    prevActiveElement?.classList.toggle('focus', false);
                    document.activeElement!.classList.toggle('focus', true);
                }
            });
        subscription.add(
            fromEvent<FocusEvent>(document, 'focusout').subscribe((event) => {
                if (!event.relatedTarget) {
                    const settingsDialog = document.querySelector('.system .settings-dialog');
                    const activeElements = (settingsDialog ? system : document).querySelectorAll(
                        '.focus'
                    );
                    for (const activeElement of activeElements) {
                        activeElement.classList.toggle('focus', false);
                    }
                }
            })
        );
        subscription.add(
            fromEvent<MouseEvent>(document, 'mouseup').subscribe(() => {
                // The `active` classes are set by individual components.
                const activeElements = document.querySelectorAll('.active');
                for (const activeElement of activeElements) {
                    activeElement.classList.toggle('active', false);
                }
            })
        );
        subscription.add(fromEvent(system, 'mousedown').subscribe(stopPropagation));
        subscription.add(subscribe(app));
        subscription.add(subscribe(system));
        return () => subscription.unsubscribe();
    }, []);
}
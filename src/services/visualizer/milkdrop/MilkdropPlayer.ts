import butterchurn from 'butterchurn';
import {MilkdropVisualizer} from 'types/Visualizer';
import AbstractVisualizerPlayer from '../AbstractVisualizerPlayer';
import {Logger} from 'utils';

const logger = new Logger('MilkdropPlayer');

export default class MilkdropPlayer extends AbstractVisualizerPlayer<MilkdropVisualizer> {
    private readonly canvas = document.createElement('canvas');
    private readonly context2D = this.canvas.getContext('2d')!;
    private readonly visualizer: ButterchurnVisualizer;
    private animationFrameId = 0;

    constructor(private readonly analyser: AnalyserNode) {
        super();

        this.canvas.hidden = true;
        this.canvas.className = `visualizer visualizer-milkdrop`;

        const visualizer = (this.visualizer = butterchurn.createVisualizer(
            analyser.context,
            this.canvas,
            {width: 400, height: 200}
        ));

        visualizer.connectAudio(analyser);
    }

    get hidden(): boolean {
        return this.canvas.hidden;
    }

    set hidden(hidden: boolean) {
        if (this.canvas.hidden !== hidden) {
            this.canvas.hidden = hidden;
            if (hidden) {
                this.visualizer.disconnectAudio(this.analyser);
            } else {
                this.visualizer.connectAudio(this.analyser);
                if (!this.animationFrameId) {
                    this.render();
                }
            }
        }
    }

    appendTo(parentElement: HTMLElement): void {
        parentElement.append(this.canvas);
    }

    load(visualizer: MilkdropVisualizer): void {
        if (visualizer) {
            logger.log(`Using butterchurn preset: ${visualizer.name}`);
            this.visualizer.loadPreset(visualizer.data, 0.5);
        }
        this.play();
    }

    play(): void {
        logger.log('play');
        if (!this.animationFrameId) {
            this.render();
        }
    }

    pause(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
    }

    stop(): void {
        this.pause();
        this.clear();
    }

    resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.visualizer.render(); // Need to render at least once before we resize
        this.visualizer.setRendererSize(width, height);
        this.visualizer.render();
    }

    private clear(): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        this.context2D.clearRect(0, 0, width, height);
    }

    private render(): void {
        this.visualizer.render();
        if (this.autoplay && !this.canvas.hidden) {
            this.animationFrameId = requestAnimationFrame(() => this.render());
        }
    }
}
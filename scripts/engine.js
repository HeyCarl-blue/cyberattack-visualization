import * as THREE from "three";

const EngineType = {
    FLUIDPARTICLE: 0,
    GRIDVIRUS: 1,
}

const h = 1;
const h2 = h * h;
const h5 = h2 * h2 * h;
const h6 = h5 * h;
const h9 = h6 * h2 * h;

class Particle {
    constructor() {
        this.x = Math.random();
    }
}

class FluidParticleEngine {

    constructor () {
        this.particles = [];
    }

    simulationStep (deltaTime) {

    }
}

class GridVirusEngine {

    simulationStep (deltaTime) {

    }
}

export default class Engine extends EventTarget {
    constructor () {
        super();
        this.initTHREE();
        this.fluidParticleEngine = new FluidParticleEngine();
        this.gridVirusEngine = new GridVirusEngine();

        // INIT SIMULATION AND RENDERING
        this.activeEngine = EngineType.FLUIDPARTICLE;
        this.simulationStopped = false;
        this.lastTime = 0;
    }

    initTHREE () {
        this.simulation = this.simulation.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera();
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
        });
        this.canvas = document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', this.resizeCanvas);
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    pauseSimulation() {
        this.simulationStopped = true;
        this.signalSimulationToggled();
    }

    startSimulation() {
        this.simulationStopped = false;
        this.signalSimulationToggled();
    }

    toggleSimulation() {
        this.simulationStopped = !this.simulationStopped;
        this.signalSimulationToggled();
    }

    reset() {
        console.log("reset");
    }

    getActiveEngine() {
        switch (this.activeEngine) {
            case EngineType.FLUIDPARTICLE:
                return this.fluidParticleEngine;
            case EngineType.GRIDVIRUS:
                return this.gridVirusEngine;
        }
    }

    getSimulationPlayIcon() {
        return this.simulationStopped ? '▶' : '⏸';
    }

    simulation (currentTime) {
        if (this.simulationStopped) {
            requestAnimationFrame(this.simulation);
            return;
        }

        currentTime *= 0.001;
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.getActiveEngine().simulationStep(deltaTime);
        this.render(deltaTime);

        requestAnimationFrame(this.simulation);
    }

    render (deltaTime) {
        switch (this.activeEngine) {
            case EngineType.FLUIDPARTICLE:
                this.renderFluid(deltaTime);
            case EngineType.GRIDVIRUS:
                this.renderGrid(deltaTime);
        }

        this.signalFrameRendered(deltaTime);
    }

    renderFluid (deltaTime) {

    }

    renderGrid (deltaTime) {

    }

    signalFrameRendered (deltaTime) {
        queueMicrotask(() => {
            this.dispatchEvent(new CustomEvent('frameRendered', {
                detail: {
                    time: this.lastTime,
                    fps: 1 / deltaTime,
                }
            }));
        });
    }

    signalSimulationToggled () {
        queueMicrotask(() => {
            this.dispatchEvent(new CustomEvent('simulationToggled', {
                detail: {
                    simulationStopped: this.simulationStopped,
                }
            }));
        });
    }
}
import * as THREE from "three";

const EngineType = {
    FLUIDPARTICLE: 0,
    GRIDVIRUS: 1,
};

const FluidRenderMode = {
    PARTICLES: 0,
    FLUID: 1,
};

const FRUSTUM_SIZE = 1;

export default class Engine extends EventTarget {
    constructor () {
        super();
        this.initTHREE();
        this.initEngines();

        // INIT SIMULATION AND RENDERING
        this.activeEngine = EngineType.FLUIDPARTICLE;
        this.simulationStopped = false;
        this.lastTime = 0;
    }

    initTHREE () {
        this.simulation = this.simulation.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.OrthographicCamera();
        this.camera.near = 0.1;
        this.camera.far = 1000;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
        });
        this.renderer.setClearColor(0xffffff);

        // Canvas
        this.canvas = document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', this.resizeCanvas);

        this.resizeCanvas();
    }

    initEngines () {
        this.fluidParticleEngine = this.fluidParticleEngine();
        this.gridVirusEngine = this.gridVirusEngine();
        this.fluidParticleEngine.init();
        this.gridVirusEngine.init();
    }

    resizeCanvas () {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const aspectRatio = this.canvas.width / this.canvas.height;
        this.camera.left = FRUSTUM_SIZE * aspectRatio / -2;
        this.camera.right = FRUSTUM_SIZE * aspectRatio / 2;
        this.camera.top = FRUSTUM_SIZE / 2;
        this.camera.bottom = FRUSTUM_SIZE / -2;

        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.canvas.width, this.canvas.height);
    }

    pauseSimulation () {
        this.simulationStopped = true;
        this.signalSimulationToggled();
    }

    startSimulation () {
        this.simulationStopped = false;
        this.signalSimulationToggled();
    }

    toggleSimulation () {
        this.simulationStopped = !this.simulationStopped;
        this.signalSimulationToggled();
    }

    reset () {
        console.log("reset");
    }

    getActiveEngine () {
        switch (this.activeEngine) {
            case EngineType.FLUIDPARTICLE:
                return this.fluidParticleEngine;
            case EngineType.GRIDVIRUS:
                return this.gridVirusEngine;
        }
    }

    getSimulationPlayIcon () {
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

        this.signalFrameRendered(deltaTime);
    }

    render () {
        this.getActiveEngine().render();

        this.renderer.render(this.scene, this.camera);
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

    fluidParticleEngine () {
        const engine = this;

        const h = 1;
        const h2 = h * h;
        const h5 = h2 * h2 * h;
        const h6 = h5 * h;
        const h9 = h6 * h2 * h;

        const WPOLY_COEFF = 315.0 / (64.0 * Math.PI * h9);
        const SPIKY_COEFF = -45.0 / (Math.PI * h6);
        const LAPLACIAN_COEFF = 45.0 / (Math.PI * h5);

        const MAX_PARTICLES = 1000;
        const GRAVITY = 9.8;
        const FORCE_ATTRITION = 0.2;

        const Wpoly6 = function (r2) {
            let temp = h2 - r2;
            return WPOLY_COEFF * temp * temp * temp;
        };

        const Wspiky = function (r) {
            let temp = h - r;
            return SPIKY_COEFF * temp * temp / r;
        };

        const Wlaplacian = function (r) {
            return LAPLACIAN_COEFF * (1 - r / h);
        };

        const particle = function () {
            return {
                // Particle positon
                x: Math.random() * (engine.camera.right - engine.camera.left) + engine.camera.left,
                y: Math.random() * (engine.camera.bottom - engine.camera.top) + engine.camera.top,

                // Particle velocity
                Vx: Math.random() - 0.5,
                Vy: Math.random() - 0.5,

                rho: 0,     // Density
                p: 0,       // Pressure

                // Particle applied force
                Fx: 0,
                Fy:0,
            }
        };

        return {
            particles: [],
            particleMeshes: [],
            particleGeometry: new THREE.CircleGeometry(10, 16),
            particleMaterial: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
            init: function () {
                this.particles = new Array(MAX_PARTICLES);
                this.particlesMeshes = new Array(MAX_PARTICLES);
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    this.particles[i] = particle();
                    this.particleMeshes[i] = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
                    engine.scene.add(this.particleMeshes[i]);
                }
            },
            applyForces: function (deltaTime) {

            },
            simulationStep: function (deltaTime) {
                this.applyForces(deltaTime);
            },
            render: function () {
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    this.particleMeshes[i].position.x = this.particles[i].x;
                    this.particleMeshes[i].position.y = this.particles[i].y;
                }
            }
        };
    }

    gridVirusEngine () {

        return {
            init: function () {

            },
            simulationStep: function (deltaTime) {

            },
            render: function () {

            }
        };
    }
}
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
        this.deltaTime = 0.0001;
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

    simulationStep () {
        this.getActiveEngine().simulationStep(this.deltaTime);
    }

    simulation (currentTime) {
        currentTime *= 0.001;
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.simulationStopped) {
            requestAnimationFrame(this.simulation);
            return;
        }

        this.simulationStep();
        this.render();

        requestAnimationFrame(this.simulation);

        this.signalFrameRendered();
    }

    render () {
        this.getActiveEngine().render();

        this.renderer.render(this.scene, this.camera);
    }

    restart () {
        this.scene.clear();
        this.getActiveEngine().restart();
    }

    signalFrameRendered () {
        queueMicrotask(() => {
            this.dispatchEvent(new CustomEvent('frameRendered', {
                detail: {
                    time: this.lastTime,
                    fps: 1 / this.deltaTime,
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

        const MAX_PARTICLES = 1000;
        const GRAVITY = 0.98;
        // const BOUNCE_DAMPING = 0.5;

        const PILLARS_HEIGHT = 1;
        const PARTICLE_RADIUS_MULTIPLIER = 0.01;

        const particle = function (x, y) {
            return {
                // Particle positon
                x: x,
                y: y,

                // Particle velocity
                Vx: 0,
                Vy: 0,
            }
        };

        return {
            particles: [],
            grid: {},
            particleMeshes: [],
            particleRadius: PARTICLE_RADIUS_MULTIPLIER,
            particleGeometry: new THREE.CircleGeometry(PARTICLE_RADIUS_MULTIPLIER, 16),
            particleMaterial: new THREE.MeshBasicMaterial({ color: 0x00bbbb }),
            init: function () {
                this.restart();
            },
            restart: function () {
                this.particles = new Array(MAX_PARTICLES);
                this.particlesMeshes = new Array(MAX_PARTICLES);
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    this.particles[i] = particle(engine.camera.left, 0);
                    this.particleMeshes[i] = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
                    this.particleMeshes[i].position.x = this.particles[i].x;
                    this.particleMeshes[i].position.y = this.particles[i].y;
                    this.particleMeshes[i].position.z = -1;
                    engine.scene.add(this.particleMeshes[i]);
                }
            },
            setParticleRadius: function (radius) {
                this.particleRadius = radius * PARTICLE_RADIUS_MULTIPLIER;
            },
            simulationStep: function (deltaTime) {
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    const p = this.particles[i];

                    //Apply Gravity
                    p.Vy -= GRAVITY * deltaTime;
                    
                    p.x += p.Vx * deltaTime;
                    p.y += p.Vy * deltaTime;
                }
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
            simulationStep: function () {

            },
            render: function () {

            }
        };
    }
}
import * as THREE from "three";

export const EngineType = {
    FLUIDPARTICLE: 0,
    GRIDVIRUS: 1,
};

export const FluidParameter = {
    PARTICLE_RADIUS: 0,
    SERVER_CAPACITY: 1,
};

const FRUSTUM_SIZE = 1;

export class Engine extends EventTarget {
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
        this.fluidParticleEngine = this.newFluidParticleEngine();
        this.gridVirusEngine = this.newGridVirusEngine();
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

    setFluidParameter (parameter, value) {
        this.fluidParticleEngine.setParameter(parameter, value);
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

    newFluidParticleEngine () {
        const engine = this;

        const MAX_PARTICLES = 1000;
        const GRAVITY = 0.98;
        // const BOUNCE_DAMPING = 0.5;

        const PILLARS_HEIGHT = 0.25;
        const PARTICLE_RADIUS_MULTIPLIER = 0.01;

        const PARTICLE_GEOMETRY = new THREE.CircleGeometry(PARTICLE_RADIUS_MULTIPLIER, 16);
        const PARTICLE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x00bbbb });
        const CURVE_MATERIAL = new THREE.LineBasicMaterial({ color: 0x000000 });

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
            particleSources: [],
            particleMeshes: [],
            parameters: {
                particleRadius: PARTICLE_RADIUS_MULTIPLIER,
                serverCapacity: 0.5,
            },
            particleGeometry: PARTICLE_GEOMETRY,
            particleMaterial: PARTICLE_MATERIAL,
            curveMaterial: CURVE_MATERIAL,
            curve1: null,
            curve2: null,
            init: function () {
                this.restart();
            },
            restart: function () {
                this.particles = new Array(MAX_PARTICLES);
                this.particlesMeshes = new Array(MAX_PARTICLES);
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    this.particles[i] = particle(0, 0);
                    this.particleMeshes[i] = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
                    this.particleMeshes[i].position.x = this.particles[i].x;
                    this.particleMeshes[i].position.y = this.particles[i].y;
                    this.particleMeshes[i].position.z = -1;
                    engine.scene.add(this.particleMeshes[i]);
                }

                this.refreshServerCapacity();
                engine.scene.add(this.curve1, this.curve2);

                console.log(engine.scene.children);
            },

            setParameter: function (parameter, value) {
                switch (parameter) {
                    case FluidParameter.PARTICLE_RADIUS:
                        this.setParticleRadius(value);
                    case FluidParameter.SERVER_CAPACITY:
                        this.setServerCapacity(value);
                    default:
                        console.error(`Invalid parameter: ${parameter}`);
                }
            },

            setParticleRadius: function (radius) {
                this.parameters.particleRadius = radius * PARTICLE_RADIUS_MULTIPLIER;
            },

            setServerCapacity: function (capacity) {
                this.parameters.serverCapacity = capacity;
                console.log(capacity);
                this.refreshServerCapacity();
            },

            refreshServerCapacity: function () {
                const curve1 = new THREE.QuadraticBezierCurve (
                    new THREE.Vector2(engine.camera.left, 0),
                    new THREE.Vector2(engine.camera.left, engine.camera.bottom + PILLARS_HEIGHT),
                    new THREE.Vector2(-this.parameters.serverCapacity * 0.5, engine.camera.bottom + PILLARS_HEIGHT),
                );
                const curve2 = new THREE.QuadraticBezierCurve (
                    new THREE.Vector2(engine.camera.right, 0),
                    new THREE.Vector2(engine.camera.right, engine.camera.bottom + PILLARS_HEIGHT),
                    new THREE.Vector2(this.parameters.serverCapacity * 0.5, engine.camera.bottom + PILLARS_HEIGHT),
                );
                const curve1Geometry = new THREE.BufferGeometry().setFromPoints(curve1.getPoints(50));
                const curve2Geometry = new THREE.BufferGeometry().setFromPoints(curve2.getPoints(50));

                this.curve1 = new THREE.Line(curve1Geometry, this.curveMaterial);
                this.curve2 = new THREE.Line(curve2Geometry, this.curveMaterial);

                this.curve1.position.z = -1;
                this.curve2.position.z = -1;
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

    newGridVirusEngine () {

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
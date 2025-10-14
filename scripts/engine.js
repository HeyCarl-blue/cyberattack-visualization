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

        const h = 1;
        const h2 = h * h;
        const h5 = h2 * h2 * h;
        const h6 = h5 * h;
        const h9 = h6 * h2 * h;

        const WPOLY_COEFF = 315.0 / (64.0 * Math.PI * h9);
        const SPIKY_COEFF = -45.0 / (Math.PI * h6);
        const LAPLACIAN_COEFF = 45.0 / (Math.PI * h5);

        const MAX_PARTICLES = 3200;
        const GRAVITY = 0.98;
        const FORCE_ATTRITION = 0.8;
        const PARTICLE_MASS = 1;
        const GAS_CONSTANT = 120;
        const REST_DENSITY = 0;
        const VISCOSITY_CONSTANT = 3;

        const PARTICLE_RADIUS_MULTIPLIER = 0.006;

        const wPoly6 = function (r2) {
            let temp = h2 - r2;
            return WPOLY_COEFF * temp * temp * temp;
        };

        const wSpiky = function (r) {
            let temp = h - r;
            return SPIKY_COEFF * temp * temp / r;
        };

        const wLaplacian = function (r) {
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
            }
        };

        const distSquared = function (p1, p2) {
            const distX = p2.x - p1.x;
            const distY = p2.y - p1.y;
            return distX * distX + distY * distY;
        };

        const addDensity = function (p1, p2) {
            let r2 = distSquared(p1, p2);
            if (r2 < h2) {
                let temp = PARTICLE_MASS * wPoly6(r2);
                p1.rho += temp;
                p2.rho += temp;
            }
        };

        const addForces = function (p1, p2) {
            let r2 = distSquared(p1, p2);
            if (r2 < h2 && r2 != 0) {
                let r = Math.sqrt(r2); + 1e-6;

                if (r == 0) {
                    console.warn("division by zero");
                }

                // Pressure Force
                let temp1 = PARTICLE_MASS * wSpiky(r) * (p2.p + p1.p) / (2 * p2.rho);
                let Vx = temp1 * (p2.x - p1.x);
                let Vy = temp1 * (p2.y - p1.y);

                // Viscosity Force
                let temp2 = VISCOSITY_CONSTANT * PARTICLE_MASS * wLaplacian(r) / p2.rho;
                Vx += temp2 * (p2.Vx - p1.Vx);
                Vy += temp2 * (p2.Vy - p1.Vy);
                p1.Vx += Vx / p1.rho;
                p1.Vy += Vy / p1.rho;
                p2.Vx -= Vx / p2.rho;
                p2.Vy -= Vy / p2.rho;
            }
        }

        return {
            particles: [],
            particleMeshes: [],
            particleGeometry: new THREE.CircleGeometry(PARTICLE_RADIUS_MULTIPLIER, 16),
            particleMaterial: new THREE.MeshBasicMaterial({ color: 0x00bbbb }),
            init: function () {
                this.restart();
            },
            restart: function () {
                this.particles = new Array(MAX_PARTICLES);
                this.particlesMeshes = new Array(MAX_PARTICLES);
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    this.particles[i] = particle();
                    this.particleMeshes[i] = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
                    this.particleMeshes[i].position.x = this.particles[i].x;
                    this.particleMeshes[i].position.y = this.particles[i].y;
                    this.particleMeshes[i].position.z = -1;
                    engine.scene.add(this.particleMeshes[i]);
                }
            },
            calculateDensity: function () {
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    const p1 = this.particles[i];
                    for (let j = 0; j < MAX_PARTICLES; j++) {
                        const p2 = this.particles[j];
                        addDensity(p1, p2);
                    }
                    p1.p = Math.max(GAS_CONSTANT * (p1.rho - REST_DENSITY), 0);
                }
            },
            calculateForces: function () {
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    const p1 = this.particles[i];
                    for (let j = 0; j < MAX_PARTICLES; j++) {
                        const p2 = this.particles[j];
                        addForces(p1, p2);
                    }

                    // Wall Forces
                    const x = p1.x;
                    const y = p1.y;
                    const checkCollisionX = (x < engine.camera.left + PARTICLE_RADIUS_MULTIPLIER) || (x > engine.camera.right - PARTICLE_RADIUS_MULTIPLIER);
                    const checkCollisionY = (y < engine.camera.bottom + PARTICLE_RADIUS_MULTIPLIER) || (y > engine.camera.top - PARTICLE_RADIUS_MULTIPLIER);
                    if (checkCollisionX) {
                        p1.Vx *= -FORCE_ATTRITION;
                    }
                    if (checkCollisionY) {
                        p1.Vy *= -FORCE_ATTRITION;
                    }
                }
            },
            simulationStep: function (deltaTime) {
                this.calculateDensity();
                this.calculateForces();
                for (let i = 0; i < MAX_PARTICLES; i++) {
                    // Apply Gravity
                    this.particles[i].Vy -= GRAVITY;
                    // Update Positions
                    this.particles[i].x += this.particles[i].Vx * deltaTime;
                    this.particles[i].y += this.particles[i].Vy * deltaTime;
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
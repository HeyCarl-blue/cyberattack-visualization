import * as THREE from "three";
import {parsePcapFile} from "./pcap_parser";

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

    setPcapFile (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.scene.clear();
            const pcapFile = parsePcapFile(e.target.result);
            this.fluidParticleEngine.loadPcap(pcapFile);
        };
        reader.readAsArrayBuffer(file);
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

    newFluidParticleEngine () {
        const engine = this;

        const DELAY = 1000;

        const MAX_PARTICLES = 100;
        const GRAVITY = 0.98;
        // const BOUNCE_DAMPING = 0.5;

        const PILLARS_HEIGHT = 0.25;
        const PARTICLE_RADIUS_MULTIPLIER = 0.01;

        const PARTICLE_GEOMETRY = new THREE.CircleGeometry(PARTICLE_RADIUS_MULTIPLIER, 16);
        const PARTICLE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x00bbbb });
        const CURVE_MATERIAL = new THREE.LineBasicMaterial({ color: 0x000000 });

        const particle = function (x, y, particleGeometry = PARTICLE_GEOMETRY, particleMaterial = PARTICLE_MATERIAL) {
            const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
            particleMesh.position.x = x;
            particleMesh.position.y = y;
            particleMesh.position.z = -1;

            return {
                // Particle mesh
                mesh: particleMesh,

                // Particle velocity
                Vx: 0,
                Vy: 0,

                // Check collision to another particle
                checkCollision: function (p) {
                    // let c1 = new THREE.Vector3();
                    // this.mesh.getWorldPosition(c1);
                    // const c2 = new THREE.Vector3();
                    // p.mesh.getWorldPosition(c2);
                    const c1 = this.mesh.position;
                    const c2 = p.mesh.position;
                    const r1 = this.mesh.geometry.parameters.radius;
                    const r2 = p.mesh.geometry.parameters.radius;
                    const dist = new THREE.Vector2(c1.x - c2.x, c1.y - c2.y);
                    const rSq = (r1 + r2) * (r1 + r2);
                    if (dist.length() < r1 + r2) {
                        return {collision: true, dist: dist.normalize()};
                    }
                    return {collision: false, dist: null};
                },

                isInMovement: function () {
                    return this.Vx != 0 || this.Vy != 0;
                }
            }
        };

        const particleSource = function (x, y, spawnRate=1, packetsToSpawn=[]) {
            return {
                x: x,
                y: y,
                spawnRate: spawnRate,
                packetsToSpawn: packetsToSpawn,
            };
        };

        return {
            particles: [],
            particleSources: [],
            parameters: {
                particleRadius: PARTICLE_RADIUS_MULTIPLIER,
                serverCapacity: 0.5,
                maxParticles: MAX_PARTICLES,
            },
            particleGeometry: PARTICLE_GEOMETRY,
            particleMaterial: PARTICLE_MATERIAL,
            curveMaterial: CURVE_MATERIAL,
            curve1: null,
            curve2: null,

            init: function () {
                this.restart();
            },

            addSource : function (source) {
                this.particleSources.push(source);
            },

            loadPcap(pcapFile) {
                // TODO: Case for non-ethernet frame
                const packets = pcapFile.packets.filter(element => {
                    return element.packet.payload !== undefined;
                });
                // let sourceIPs = new Set();
                // let destIPs = new Set();

                const baseMilliseconds = packets[0].header.tsSec * 1000 + packets[0].header.tsUsec;
                const convertIntoMillisecondsFromStart = function (tsSec, tsUsec) {
                    return (tsSec * 1000 + tsUsec) - baseMilliseconds;
                }

                const packetsToSpawn = packets.map((element) => {
                    return {
                        milliseconds: convertIntoMillisecondsFromStart(element.header.tsSec, element.header.tsUsec),
                        payload: element.packet.payload
                    }
                });
                this.addSource(particleSource(0, 0.25, 0, packetsToSpawn));
                console.log(packetsToSpawn);
                this.restart();
            },

            spawnParticle (source) {
                const posx = source.x + Math.random() * 0.01;
                const posy = source.y + Math.random() * 0.01;
                const p = particle(posx, posy)
                this.particles.push(p);
                engine.scene.add(p.mesh);
            },

            restart: function () {
                this.particles = [];
                // TODO RESTART FROM SAVED STATE
                if (this.particleSources.length <= 0) {
                    // this.particles = new Array(this.parameters.maxParticles);
                    // this.particlesMeshes = new Array(this.parameters.maxParticles);
                    // for (let i = 0; i < this.parameters.maxParticles; i++) {
                    //     this.particles[i] = particle(0, 0);
                    //     engine.scene.add(this.particles[i].mesh);
                    // }
                    this.spawnParticle(particleSource(0, 0));
                    setTimeout(() => {this.spawnParticle(particleSource(0, 0))}, 1000);
                } else {
                    this.particles = [];
                    for (let source of this.particleSources) {
                        for (let packet of source.packetsToSpawn) {
                            setTimeout(() => {this.spawnParticle(source)}, packet.milliseconds + DELAY);
                        }
                    }
                }

                this.refreshServerCapacity();
                engine.scene.add(this.curve1, this.curve2);
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
                for (let p of this.particles) {
                    //Apply Gravity
                    p.Vy -= GRAVITY * deltaTime;

                    // Update Positions
                    p.mesh.position.x += p.Vx * deltaTime;
                    p.mesh.position.y += p.Vy * deltaTime;
                    
                    console.log(p.mesh.geometry.parameters.radius);

                    // Check Collision
                    this.checkParticleCollision(p);

                    this.checkWallCollisions(p);
                }
            },

            checkParticleCollision: function (currentParticle) {
                for (let p of this.particles) {
                    if (!currentParticle.isInMovement() || currentParticle === p) continue;
                    const collResult = currentParticle.checkCollision(p);
                    if (collResult.collision) {
                        const collisionPoint = collResult.dist.multiplyScalar(currentParticle.mesh.geometry.parameters.radius);
                        currentParticle.mesh.position.x += collisionPoint.x;
                        currentParticle.mesh.position.y += collisionPoint.y;
                        currentParticle.Vx = 0;
                        currentParticle.Vy = 0;
                    }
                }
            },

            checkWallCollisions: function (p) {
                const leftLimit = engine.camera.left + (this.parameters.particleRadius * 0.5);
                const rightLimit = engine.camera.right - (this.parameters.particleRadius * 0.5);
                const topLimit = engine.camera.top - (this.parameters.particleRadius * 0.5);
                const bottomLimit = engine.camera.bottom + (this.parameters.particleRadius * 0.5);

                if (p.mesh.position.x >= rightLimit) {
                    p.mesh.position.x = rightLimit;
                    p.Vx = 0;
                }
                if (p.mesh.position.x <= leftLimit) {
                    p.mesh.position.x = leftLimit;
                    p.Vx = 0;
                }
                if (p.mesh.position.y <= bottomLimit) {
                    p.mesh.position.y = bottomLimit;
                    p.Vy = 0;
                }
                if (p.mesh.position.y >= topLimit) {
                    p.mesh.position.y = topLimit;
                    p.Vy = 0;
                }
            },
        };
    }

    newGridVirusEngine () {

        return {
            init: function () {

            },
            simulationStep: function () {

            },
        };
    }
}
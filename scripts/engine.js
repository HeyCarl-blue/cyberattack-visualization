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

const CollisionType = {
    NO_COLLISION: 0,
    COLLISION: 1,
    INTERPENETRATING: -1
}

const FRUSTUM_SIZE = 1;

class Quadtree {
    constructor (boundary, capacity = 4) {
        this.boundary = boundary;
        this.capacity = capacity;
        this.particles = [];
        this.divided = false;
        this.northeast = null;
        this.southeast = null;
        this.southwest = null;
        this.northwest = null;
    }

    subdivide () {
        const x = this.boundary.x;
        const y = this.boundary.y;
        const w = this.boundary.width * 0.5;
        const h = this.boundary.height * 0.5;

        const ne = { x: x + w, y: y + h, width: w, height: h };
        const nw = { x: x, y: y + h, width: w, height: h };
        const se = { x: x + w, y: y, width: w, height: h };
        const sw = { x: x, y: y, width: w, height: h };

        this.northeast = new Quadtree(ne, this.capacity);
        this.northwest = new Quadtree(nw, this.capacity);
        this.southeast = new Quadtree(se, this.capacity);
        this.southwest = new Quadtree(sw, this.capacity);

        this.divided = true;
    }

    contains (particle) {
        const pos = particle.position();
        return (
            pos.x >= this.boundary.x &&
            pos.x < this.boundary.x + this.boundary.width &&
            pos.y >= this.boundary.y &&
            pos.y < this.boundary.y + this.boundary.height
        );
    }

    insert (particle) {
        if (!this.contains(particle)) {
            return false;
        }

        if (this.particles.length <= this.capacity) {
            this.particles.push(particle);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
        }

        return (
            this.northeast.insert(particle) ||
            this.northwest.insert(particle) ||
            this.southeast.insert(particle) ||
            this.southwest.insert(particle)
        );
    }

    intersect (range) {
        return !(
            range.x > this.boundary.x + this.boundary.width ||
            range.x + range.width < this.boundary.x ||
            range.y > this.boundary.y + this.boundary.height ||
            range.y + range.height < this.boundary.y
        )
    }

    particleInRange (particle, range) {
        const pos = particle.position();
        return (
            pos.x >= range.x &&
            pos.x < range.x + range.width &&
            pos.y >= range.y &&
            pos.y < range.y + range.height
        );
    }

    query (range, found = []) {
        if (!this.intersect(range)) {
            return found;
        }

        for (let p of this.particles) {
            if (this.particleInRange(p, range)) {
                found.push(p);
            }
        }

        if (this.divided) {
            this.northeast.query(range, found);
            this.northwest.query(range, found);
            this.southeast.query(range, found);
            this.southwest.query(range, found);
        }

        return found;
    }
}

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
            this.fluidParticleEngine.restart();
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
        const COLLISION_TOLERANCE = 0.0001;
        const COEFFICIENT_OF_RESTITUTION = 0.5;
        const LINEAR_DRAG = 0.25;
        const PARTICLE_MASS = 1;

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

                // when the server starts processing the "particle"
                startProcessingTime: Infinity,

                // Check collision to another particle
                checkCollision: function (p) {
                    const c1 = this.position();
                    const c2 = p.position();
                    const r = this.radius() + p.radius();
                    const d = new THREE.Vector2(c1.x - c2.x, c1.y - c2.y);
                    const s = d.length() - r;
                    const normal = d.normalize();

                    const relativeVelocity = new THREE.Vector2(this.Vx - p.Vx, this.Vy - p.Vy);
                    const vrn = relativeVelocity.dot(normal);

                    if ( (Math.abs(s) <= COLLISION_TOLERANCE) && (vrn < 0.0) ) {
                        return {
                            collision: CollisionType.COLLISION,
                            normal: normal,
                            relativeVelocity: relativeVelocity,
                            collisionPoint: normal.multiplyScalar(this.radius() + p.radius())
                        }
                    } else if (s < -COLLISION_TOLERANCE) {
                        return {
                            collision: CollisionType.INTERPENETRATING,
                            normal: normal,
                            relativeVelocity: relativeVelocity,
                            collisionPoint: normal.multiplyScalar(this.radius() + p.radius())
                        }
                    } else {
                        return {
                            collision: CollisionType.NO_COLLISION,
                            normal: normal,
                            relativeVelocity: relativeVelocity,
                            collisionPoint: normal.multiplyScalar(this.radius() + p.radius())
                        }
                    }
                },

                isInMovement: function () {
                    return this.Vx != 0 || this.Vy != 0;
                },

                position: function () {
                    return this.mesh.position;
                },

                radius: function () {
                    return this.mesh.geometry.parameters.radius;
                }
            }
        };

        const particleSource = function (x, y, spawnQueue=[]) {
            return {
                x: x,
                y: y,
                spawnQueue: spawnQueue.map(item => ({
                    time: item.milliseconds,
                    payload: item.payload,
                    spawned: false
                })).sort((a, b) => a.time - b.time),
            };
        };

        return {
            particles: [],
            particleSources: [],
            quadtree: null,
            parameters: {
                particleRadius: PARTICLE_RADIUS_MULTIPLIER,
                serverCapacity: 0.5,
                maxParticles: MAX_PARTICLES,
                serverSpeed: Infinity
            },
            particleGeometry: PARTICLE_GEOMETRY,
            particleMaterial: PARTICLE_MATERIAL,
            serverRepresentation: {
                material: CURVE_MATERIAL,
                curve1: null,
                curve2: null,
                curveMesh1: null,
                curveMesh2: null,
                lineMesh1: null,
                lineMesh2: null
            },
            inputPcap: null,
            simulationTime: 0,

            init: function () {
                this.restart();
            },

            addSource: function (source) {
                this.particleSources.push(source);
            },

            buildQuadTree: function () {
                const boundary = {
                    x: engine.camera.left,
                    y: engine.camera.bottom,
                    width: engine.camera.right - engine.camera.left,
                    height: engine.camera.top - engine.camera.bottom
                };

                this.quadtree = new Quadtree(boundary, 4);

                for (let p of this.particles) {
                    this.quadtree.insert(p);
                }
            },

            getNearbyParticles: function (p) {
                const searchRadius = p.radius() * 4;

                const range = {
                    x: p.position().x - searchRadius,
                    y: p.position().y - searchRadius,
                    width: searchRadius * 2,
                    height: searchRadius * 2
                };

                return this.quadtree.query(range);
            },

            loadPcap(pcapFile) {
                this.inputPcap = pcapFile;
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

                const spawnQueue = packets.map((element) => {
                    return {
                        milliseconds: convertIntoMillisecondsFromStart(element.header.tsSec, element.header.tsUsec),
                        payload: element.packet.payload
                    }
                });
                this.particleSources = [];
                this.addSource(particleSource(0, 0, spawnQueue));
                
            },

            spawnParticle (source) {
                const posx = source.x + Math.random() * 0.01;
                const posy = source.y + Math.random() * 0.01;
                const p = particle(posx, posy)
                this.particles.push(p);
                engine.scene.add(p.mesh);
            },

            removeParticle (particle) {
                const idx = this.particles.indexOf(particle);
                if (idx > -1) {
                    this.particles.splice(idx, 1);
                    engine.scene.remove(particle.mesh);
                }
            },

            restart: function () {
                for (let p of this.particles) {
                    engine.scene.remove(p.mesh);
                }
                this.particles = [];

                this.simulationTime = 0;
                
                for (let source of this.particleSources) {
                    for (let item of source.spawnQueue) {
                        item.spawned = false;
                    }
                }

                this.refreshServerCapacity();
                this.renderServerRepresentation();
            },

            renderServerRepresentation: function () {
                engine.scene.remove(
                    this.serverRepresentation.curveMesh1,
                    this.serverRepresentation.curveMesh2,
                    this.serverRepresentation.lineMesh1,
                    this.serverRepresentation.lineMesh2
                )
                engine.scene.add(
                    this.serverRepresentation.curveMesh1,
                    this.serverRepresentation.curveMesh2,
                    this.serverRepresentation.lineMesh1,
                    this.serverRepresentation.lineMesh2
                );
            },

            refreshServerCapacity: function () {
                const x0 = engine.camera.left;
                const x1 = (engine.camera.left + engine.camera.right - this.parameters.serverCapacity) * 0.5;

                const y0 = (engine.camera.top + engine.camera.bottom) * 0.5;
                const y1 = engine.camera.bottom + PILLARS_HEIGHT;

                const xx0 = engine.camera.right;
                const xx1 = (engine.camera.left + engine.camera.right + this.parameters.serverCapacity) * 0.5;

                const bottom = engine.camera.bottom;

                this.serverRepresentation.curve1 = new THREE.QuadraticBezierCurve (
                    new THREE.Vector2(x0, y0),
                    new THREE.Vector2(x0, y1),
                    new THREE.Vector2(x1, y1)
                );
                this.serverRepresentation.curve2 = new THREE.QuadraticBezierCurve (
                    new THREE.Vector2(xx0, y0),
                    new THREE.Vector2(xx0, y1),
                    new THREE.Vector2(xx1, y1)
                );
                const curve1Geometry = new THREE.BufferGeometry().setFromPoints(this.serverRepresentation.curve1.getPoints(50));
                const curve2Geometry = new THREE.BufferGeometry().setFromPoints(this.serverRepresentation.curve2.getPoints(50));

                this.serverRepresentation.curveMesh1 = new THREE.Line(curve1Geometry, this.serverRepresentation.material);
                this.serverRepresentation.curveMesh2 = new THREE.Line(curve2Geometry, this.serverRepresentation.material);

                const line1Geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x1, y1, -1),
                    new THREE.Vector3(x1, bottom, -1)
                ]);

                const line2Geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(xx1, y1, -1),
                    new THREE.Vector3(xx1, bottom, -1)
                ]);

                this.serverRepresentation.lineMesh1 = new THREE.Line(line1Geometry, this.serverRepresentation.material);
                this.serverRepresentation.lineMesh2 = new THREE.Line(line2Geometry, this.serverRepresentation.material);

                this.serverRepresentation.curveMesh1.position.z = -1;
                this.serverRepresentation.curveMesh2.position.z = -1;
            },

            simulationStep: function (deltaTime) {
                this.simulationTime += 1000 * deltaTime;

                for (let source of this.particleSources) {
                    for (let item of source.spawnQueue) {
                        if (!item.spawned && item.time <= this.simulationTime) {
                            this.spawnParticle(source);
                            item.spawned = true;
                        }
                    }
                }

                // Collision Check
                this.buildQuadTree();

                for (let p of this.particles) {
                    // APPLY FORCES
                    p.Vy -= GRAVITY * deltaTime;

                    // Check collisions with particles
                    this.checkParticleCollision(p);

                    // check collisions with screen boundaaries
                    this.checkWallCollisions(p);

                    // check collision with server representation
                    this.checkCollisionWithServer(p);

                    // APPLY DISPLACEMENT
                    p.position().x += p.Vx * deltaTime;
                    p.position().y += p.Vy * deltaTime;

                    // check if server starts processing packet
                    if (p.startProcessingTime === Infinity && p.position().y <= engine.camera.bottom + PILLARS_HEIGHT) {
                        p.startProcessingTime = this.simulationTime;
                    }
                    // should the particle be processed and removed?
                    if (this.simulationTime - p.startProcessingTime >= this.parameters.serverSpeed) {
                        this.removeParticle(p);
                    }
                }
            },

            checkParticleCollision: function (currentParticle) {
                const nearby = this.getNearbyParticles(currentParticle);

                for (let p of nearby) {
                    if (!currentParticle.isInMovement() || currentParticle === p) {
                        continue;
                    }
                    const collResult = currentParticle.checkCollision(p);

                    if (collResult.collision === CollisionType.COLLISION) {
                        
                        // if (collResult.collision === CollisionType.INTERPENETRATING) {
                        //     currentParticle.position().x = collResult.collisionPoint.x;
                        //     currentParticle.position().y = collResult.collisionPoint.y;
                        // }

                        // Apply impulse force
                        const normalRelVel = collResult.relativeVelocity.dot(collResult.normal);
                        const n2 = collResult.normal.dot(collResult.normal);

                        const j = ( -(1 + COEFFICIENT_OF_RESTITUTION) * normalRelVel ) / ( n2 * 2 * PARTICLE_MASS);

                        const impulseVelocity = collResult.normal.multiplyScalar(j / PARTICLE_MASS);

                        currentParticle.Vx += impulseVelocity.x;
                        currentParticle.Vy += impulseVelocity.y;

                        p.Vx -= impulseVelocity.x;
                        p.Vy -= impulseVelocity.y;
                    }
                }
            },

            checkWallCollisions: function (p) {
                const leftLimit = engine.camera.left + (this.parameters.particleRadius * 0.5);
                const rightLimit = engine.camera.right - (this.parameters.particleRadius * 0.5);
                const topLimit = engine.camera.top - (this.parameters.particleRadius * 0.5);
                const bottomLimit = engine.camera.bottom + (this.parameters.particleRadius * 0.5);

                if (p.position().x >= rightLimit) {
                    p.position().x = rightLimit;
                    p.Vx = 0;
                }
                if (p.position().x <= leftLimit) {
                    p.position().x = leftLimit;
                    p.Vx = 0;
                }
                if (p.position().y <= bottomLimit) {
                    p.position().y = bottomLimit;
                    p.Vy = 0;
                }
                if (p.position().y >= topLimit) {
                    p.position().y = topLimit;
                    p.Vy = 0;
                }
            },

            checkCollisionWithServer: function (p) {
                const x1 = (engine.camera.left + engine.camera.right - this.parameters.serverCapacity) * 0.5;
                const y1 = engine.camera.bottom + PILLARS_HEIGHT;
                const xx1 = (engine.camera.left + engine.camera.right + this.parameters.serverCapacity) * 0.5;

                const bottom = engine.camera.bottom;

                const start1 = new THREE.Vector2(x1, y1);
                const end1 = new THREE.Vector2(x1, bottom);

                const start2 = new THREE.Vector2(xx1, y1);
                const end2 = new THREE.Vector2(xx1, bottom);

                const coll1 = this.collisionParticleSegment(p, start1, end1);
                const coll2 = this.collisionParticleSegment(p, start2, end2);

                if (coll1.collision !== CollisionType.NO_COLLISION || coll2.collision !== CollisionType.NO_COLLISION) {
                    p.Vx *= -0.8;
                }

                const TOTAL_POINTS = 50.0;
                const INCREMENT = 1.0 / TOTAL_POINTS;

                const curve1 = this.serverRepresentation.curve1;
                const curve2 = this.serverRepresentation.curve2;

                let collisionResult = {
                    collision: CollisionType.NO_COLLISION
                };

                let i = 0.0;
                while (collisionResult.collision === CollisionType.NO_COLLISION && i < 1.0) {
                    const j = i + INCREMENT;
                    const p0 = curve1.getPoint(i);
                    const p1 = curve1.getPoint(j);

                    const p0_2 = curve2.getPoint(i);
                    const p1_2 = curve2.getPoint(j);

                    collisionResult = this.collisionParticleSegment(p, p0, p1);
                    if (collisionResult.collision !== CollisionType.NO_COLLISION) {
                        break;
                    }
                    collisionResult = this.collisionParticleSegment(p, p0_2, p1_2);

                    i = j;
                }

                if (collisionResult.collision === CollisionType.NO_COLLISION) {
                    return;
                }

                p.Vx *= -0.8;
                p.Vy *= -0.8;
            },

            collisionParticleParticle: function (p1, p2) {

            },

            collisionParticleSegment: function (particle, startSeg, endSeg) {
                const dir = endSeg.sub(startSeg);
                const oc = new THREE.Vector2(particle.position().x, particle.position().y).sub(startSeg);
                
                const a = dir.lengthSq();
                const b = -2.0 * dir.dot(oc);
                const c = oc.lengthSq() - particle.radius() * particle.radius();

                const discriminant = b * b - 4.0 * a * c;
                const d = Math.sqrt(discriminant);

                const t0 = (-b - d) / (2.0 * a);
                const t1 = (-b + d) / (2.0 * a);

                if (discriminant < 0.0 || t1 < 0.0 || t0 > 1.0) {
                    return {
                        collision: CollisionType.NO_COLLISION
                    };
                }

                // if (discriminant === 0.0) {
                //     const f = startSeg.multiplyScalar(1 - t0);
                //     const d = endSeg.multiplyScalar(t0);
                //     return {
                //         collision: CollisionType.COLLISION,
                //         collisionPoint: f.add(d),
                //     }
                // } else {
                //     const firstPoint = startSeg.multiplyScalar(1 - t0).add(endSeg.multiplyScalar(t0));
                //     const secondPoint = startSeg.multiplyScalar(1 - t1).add(endSeg.multiplyScalar(t1));
                //     return {
                //         collision: CollisionType.INTERPENETRATING,
                //         collisionPoint: firstPoint.multiplyScalar(0.5).add(secondPoint.multiplyScalar(0.5)),
                //     }
                // }
                return { collision: CollisionType.COLLISION };
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
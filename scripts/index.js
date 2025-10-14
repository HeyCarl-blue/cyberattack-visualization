import Engine from "./engine.js";

let engine;

function initGUI() {
    // SIDEBAR
    const toggleBtn = document.getElementById('toggleBtn');
    const sidebar = document.getElementById('sidebar');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        toggleBtn.classList.toggle('active');
    });

    // SIMULATION CONTROL
    const resetSimulationBtn = document.getElementById('resetSimulationBtn');
    const toggleSimulationBtn = document.getElementById('toggleSimulationBtn');
    const nextFrameBtn = document.getElementById('nextFrameBtn');

    resetSimulationBtn.addEventListener('click', () => {
        engine.restart();
        engine.render();
    });

    toggleSimulationBtn.addEventListener('click', () => {
        engine.toggleSimulation();
        toggleSimulationBtn.innerHTML = engine.getSimulationPlayIcon();
    });
    toggleSimulationBtn.innerHTML = engine.getSimulationPlayIcon();

    nextFrameBtn.addEventListener('click', () => {
        engine.simulationStep();
        engine.render();
    });

    const fpsLabel = document.getElementById('fpsLabel');
    engine.addEventListener('frameRendered', (event) => {
        fpsLabel.innerHTML = `FPS: ${event.detail.fps.toFixed(2)}`;
        if (event.detail.fps < 30) {
            // console.warn(`low fps: ${event.detail.fps}`);
        }
    });
}

function initEngine() {
    engine = new Engine();
    requestAnimationFrame(engine.simulation);
}

document.addEventListener('DOMContentLoaded', () => {
    initEngine();
    initGUI();
});

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
        engine.reset();
    });

    toggleSimulationBtn.addEventListener('click', () => {
        engine.toggleSimulation();
        toggleSimulationBtn.innerHTML = engine.getSimulationPlayIcon();
    });
    toggleSimulationBtn.innerHTML = engine.getSimulationPlayIcon();

    nextFrameBtn.addEventListener('click', () => {

    });

    const fpsLabel = document.getElementById('fpsLabel');
    engine.addEventListener('frameRendered', (event) => {
        fpsLabel.innerHTML = `FPS: ${event.detail.fps.toFixed(2)}`;
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

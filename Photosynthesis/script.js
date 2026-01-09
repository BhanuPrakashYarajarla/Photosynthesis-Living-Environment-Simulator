// --- Simulation State ---
const state = {
    // Environment
    time: 12.0,     // 0-24 Hours (Float)
    day: 1,         // Day Counter
    autoPlay: true, // Cycle runs automatically

    // Factors (Driven by time or user)
    light: 100,      // 0-100 (Derived)
    co2: 40,        // 0-100 (Manual)
    temp: 25,       // 0-50 (Derived/Manual)

    // Plant
    growthRate: 0,  // 0-100%
    biomass: 15,    // Starting size
    limitingFactor: 'None'
};

// --- Constants ---
const OPTIMAL_TEMP = 25;
const MAX_BIOMASS = 200;

// --- Chart.js Setup ---
let rateChart;
const chartData = {
    labels: Array(20).fill(''),
    datasets: [{
        label: 'Photosynthesis Rate (%)',
        data: Array(20).fill(0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 0
    }]
};

function initChart() {
    const ctx = document.getElementById('rateChart').getContext('2d');
    rateChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                },
                x: { display: false }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

// --- Logic ---
function calculateEnvironment() {
    if (state.autoPlay) {
        // Increment Time
        state.time += 0.02; // Speed of day
        if (state.time >= 24) {
            state.time = 0;
            state.day++;
        }

        // Calculate Light (Daytime 6:00 - 18:00)
        if (state.time >= 6 && state.time <= 18) {
            // Map 6-18 to 0-PI for Sine wave
            let t = map(state.time, 6, 18, 0, PI);
            state.light = sin(t) * 100;
        } else {
            state.light = 0; // Night
        }

        // Calculate Temp (Lagged, varies 15 - 35)
        // Peak at 14:00 (14.0)
        let tempOffset = cos(map(state.time, 0, 24, 0, TWO_PI) - 0.5); // Peak offset?
        // Simple mapping: 
        // Coldest at 4am, Hottest at 2pm (14)
        // Map time shifted by -4 to 0-2PI? 
        // Let's us simple sin approximation
        let tempT = map(state.time, 0, 24, -PI / 2, 3 * PI / 2); // 0=midnight
        // Shift peak to 14:00 (approx)
        let dailyVar = sin(map(state.time - 8, 0, 24, 0, TWO_PI)) * 10;
        state.temp = 20 + dailyVar; // Base 20, +/- 10 -> 10 to 30 range

        // Clamp
        if (state.light < 0) state.light = 0;
    }
}

function calculateRate() {
    // Photosynthesis only happens if light > 0

    const lightEffect = 100 * (state.light / (state.light + 20));
    const co2Effect = 100 * (state.co2 / (state.co2 + 20)); // CO2 is manual
    const tempDiff = Math.abs(state.temp - OPTIMAL_TEMP);
    let tempEffect = 100 * Math.exp(-(Math.pow(tempDiff, 2) / 200));
    if (tempEffect < 1) tempEffect = 0;

    let rate = Math.min(lightEffect, co2Effect, tempEffect);

    // Night Logic: Rate is 0
    if (state.light < 1) rate = 0;

    state.growthRate = rate;

    // Determine Limiting Factor
    if (rate === lightEffect) state.limitingFactor = 'light';
    else if (rate === co2Effect) state.limitingFactor = 'co2';
    else state.limitingFactor = 'temp';

    return rate;
}

function updateSimulation() {
    calculateEnvironment();
    const rate = calculateRate();
    if (rate > 0 && state.biomass < MAX_BIOMASS) {
        state.biomass += rate * 0.0005;
    }

    if (frameCount % 60 === 0 && rateChart) {
        chartData.datasets[0].data.shift();
        chartData.datasets[0].data.push(rate);
        rateChart.update();
    }
}

// --- UI Handling ---
document.addEventListener('DOMContentLoaded', () => {
    initChart();

    const sliders = {
        light: document.getElementById('slider-light'),
        co2: document.getElementById('slider-co2'),
        temp: document.getElementById('slider-temp')
    };

    const displays = {
        light: document.getElementById('val-light'),
        co2: document.getElementById('val-co2'),
        temp: document.getElementById('val-temp'),
        biomass: document.getElementById('stat-biomass'),
        limit: document.getElementById('limiting-factor-label'),
        overlayRate: document.getElementById('overlay-rate'),
        overlayLimit: document.getElementById('overlay-limit'),
        clock: document.getElementById('clock-display'),
        pauseBtn: document.getElementById('btn-pause')
    };

    const groups = {
        light: document.getElementById('ctrl-light'),
        co2: document.getElementById('ctrl-co2'),
        temp: document.getElementById('ctrl-temp')
    };

    // Manual Input Handling
    function handleManualInput(e) {
        state.autoPlay = false; // Pause natural cycle
        displays.pauseBtn.innerText = "▶"; // Show Play icon

        state.light = parseInt(sliders.light.value);
        state.co2 = parseInt(sliders.co2.value);
        state.temp = parseInt(sliders.temp.value);
    }

    // CO2 always manual, doesn't pause time? 
    // Let's say touching Light/Temp pauses time. CO2 is independent.
    sliders.light.addEventListener('input', handleManualInput);
    sliders.temp.addEventListener('input', handleManualInput);

    sliders.co2.addEventListener('input', (e) => {
        state.co2 = parseInt(e.target.value);
    });

    // Pause Button
    displays.pauseBtn.addEventListener('click', () => {
        state.autoPlay = !state.autoPlay;
        displays.pauseBtn.innerText = state.autoPlay ? "⏸" : "▶";
    });

    setInterval(() => {
        // UI Updates
        // Sync Sliders to State (if AutoPlay)
        if (state.autoPlay) {
            sliders.light.value = state.light;
            sliders.temp.value = state.temp;
        }

        // Sync Displays
        displays.light.innerText = Math.floor(state.light);
        displays.co2.innerText = state.co2;
        displays.temp.innerText = Math.floor(state.temp);

        // Update Clock
        let h = Math.floor(state.time);
        let m = Math.floor((state.time - h) * 60);
        let mStr = m < 10 ? `0${m}` : m;
        displays.clock.innerHTML = `Day ${state.day} <span class="time-divider">|</span> ${h}:${mStr}`;

        // Growth Bar
        const bar = document.getElementById('bar-growth');
        bar.style.width = `${state.growthRate}%`;
        displays.biomass.innerText = Math.floor(state.biomass);

        Object.values(groups).forEach(g => g.classList.remove('limiting-factor'));

        let limitText = 'None';
        if (state.growthRate < 95) {
            if (state.limitingFactor === 'light') {
                groups.light.classList.add('limiting-factor');
                limitText = 'Light Intensity';
            } else if (state.limitingFactor === 'co2') {
                groups.co2.classList.add('limiting-factor');
                limitText = 'CO₂ Concentration';
            } else {
                groups.temp.classList.add('limiting-factor');
                limitText = 'Temperature';
            }
        }
        displays.limit.innerText = `Limiting Factor: ${limitText}`;
        displays.overlayRate.innerText = `${Math.floor(state.growthRate)}%`;
        displays.overlayLimit.innerText = limitText;

    }, 100);

    // Overlay
    document.getElementById('btn-analysis').addEventListener('click', () => {
        document.getElementById('analysis-overlay').classList.remove('hidden');
    });
    document.getElementById('btn-close-analysis').addEventListener('click', () => {
        document.getElementById('analysis-overlay').classList.add('hidden');
    });

    // --- Mobile Toggles ---
    const btnToggleEnv = document.getElementById('btn-toggle-env');
    const btnToggleStats = document.getElementById('btn-toggle-stats');
    const panelEnv = document.getElementById('panel-env');
    const panelStats = document.getElementById('panel-stats');

    function closeAllPanels() {
        if (panelEnv) panelEnv.classList.remove('panel-active');
        if (panelStats) panelStats.classList.remove('panel-active');
        if (btnToggleEnv) btnToggleEnv.classList.remove('active');
        if (btnToggleStats) btnToggleStats.classList.remove('active');
    }

    if (btnToggleEnv && btnToggleStats) {
        btnToggleEnv.addEventListener('click', () => {
            const isOpen = panelEnv.classList.contains('panel-active');
            closeAllPanels();
            if (!isOpen) {
                panelEnv.classList.add('panel-active');
                btnToggleEnv.classList.add('active');
            }
        });

        btnToggleStats.addEventListener('click', () => {
            const isOpen = panelStats.classList.contains('panel-active');
            closeAllPanels();
            if (!isOpen) {
                panelStats.classList.add('panel-active');
                btnToggleStats.classList.add('active');
            }
        });

        document.querySelectorAll('.mobile-close-btn').forEach(btn => {
            btn.addEventListener('click', closeAllPanels);
        });
    }
});


// --- p5.js Visuals ---
let particles = [];
let bubbles = [];
let clouds = [];
let fireflies = [];
let grassBlades = [];
let waterParticles = [];
let rootSystem;

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');

    // Init CO2 particles
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle());
    }

    // Init Clouds
    for (let i = 0; i < 5; i++) {
        clouds.push(new Cloud());
    }

    // Init Fireflies
    for (let i = 0; i < 40; i++) {
        fireflies.push(new Firefly());
    }

    // Init Water
    for (let i = 0; i < 20; i++) {
        waterParticles.push(new WaterParticle());
    }

    // Init Grass
    initGrass();

    // Init Fractal Roots
    rootSystem = new RootBranch(0, 0, 90, 6, 40);
}

function initGrass() {
    grassBlades = [];
    let count = width / 6;
    for (let i = 0; i < count; i++) {
        grassBlades.push(new GrassBlade(i * 6 + random(-2, 2)));
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    initGrass();
}

function draw() {
    updateSimulation();
    drawSky();
    drawGround();

    // Clouds
    for (let c of clouds) {
        c.update();
        c.display();
    }

    // Roots & Water (Underground)
    push();
    translate(width / 2, height - 120);
    let mobileScale = width < 600 ? 0.6 : 1;
    scale(mobileScale);

    // Max energy proportional to biomass
    let rootEnergy = map(state.biomass, 0, 200, 0, 800);
    drawFractalRoots(rootSystem, rootEnergy);

    pop();

    for (let w of waterParticles) {
        w.update();
        w.display();
    }

    // Draw Plant 
    push();
    translate(width / 2, height - 120);
    scale(mobileScale);
    drawOrganicPlant(state.biomass);
    pop();

    for (let g of grassBlades) {
        g.display();
    }

    // Oxygen
    if (random(100) < state.growthRate * 0.4) {
        let plantHeight = state.biomass * 1.5;
        if (plantHeight < 20) plantHeight = 20;

        let xVar = 10 + (plantHeight * 0.5);
        let spawnX = width / 2 + random(-xVar, xVar);
        let spawnY = height - 120 - random(10, plantHeight);

        bubbles.push(new Bubble(spawnX, spawnY));
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
        bubbles[i].update();
        bubbles[i].display();
        if (bubbles[i].isDead()) bubbles.splice(i, 1);
    }

    // CO2
    let activeParticles = map(state.co2, 0, 100, 0, particles.length);
    for (let i = 0; i < activeParticles; i++) {
        particles[i].update();
        particles[i].display();
    }

    // Fireflies (Night) - Use Light State
    if (state.light < 30) {
        let opacityMult = map(state.light, 30, 0, 0, 1);
        for (let f of fireflies) {
            f.update();
            f.display(opacityMult);
        }
    }
}

function drawSky() {
    // Map TIME to sky color (0-24)
    // Night: 0-5, Day: 7-17, Twilight in between
    let t = state.time;
    let cNight = color(20, 24, 82);
    let cDawn = color(253, 184, 19);
    let cDay = color(135, 206, 235);

    let skyColor;
    if (t < 5) skyColor = cNight;
    else if (t < 7) skyColor = lerpColor(cNight, cDawn, map(t, 5, 7, 0, 1));
    else if (t < 10) skyColor = lerpColor(cDawn, cDay, map(t, 7, 10, 0, 1));
    else if (t < 16) skyColor = cDay;
    else if (t < 19) skyColor = lerpColor(cDay, cDawn, map(t, 16, 19, 0, 1));
    else if (t < 21) skyColor = lerpColor(cDawn, cNight, map(t, 19, 21, 0, 1));
    else skyColor = cNight;

    background(skyColor);

    let cx = width / 2;
    // Map time to angle: 6am = PI, 18pm = 0 (Sun Arc)
    // 6 = 180deg (left), 12 = 270deg (top), 18 = 360/0 (right)

    // Cycle: 0 to 24 map to 0 to TWO_PI + Offset?
    // Let's align: 6am is Rise (PI), 12 is Top (1.5 PI), 18 is Set (2 PI)
    // Map time 6..18 to PI..2PI

    let radiusX = width * 0.45;
    let radiusY = height * 0.75;

    if (t > 5 && t < 19) {
        // Sun
        let sunAngle = map(t, 6, 18, PI, 2 * PI);
        let sunX = cx + cos(sunAngle) * radiusX;
        let sunY = height * 0.9 + sin(sunAngle) * radiusY;

        noStroke();
        fill(255, 220, 100);
        drawingContext.shadowBlur = 100;
        drawingContext.shadowColor = "rgba(255, 220, 0, 0.6)";
        circle(sunX, sunY, 90);
        drawingContext.shadowBlur = 0;
    }

    // Moon (Opposite cycle)
    // Visible 18..6
    if (t >= 18 || t <= 6) {
        let moonTime = t;
        if (t <= 6) moonTime += 24; // 18..30
        let moonAngle = map(moonTime, 18, 30, PI, 2 * PI);
        let moonX = cx + cos(moonAngle) * radiusX;
        let moonY = height * 0.9 + sin(moonAngle) * radiusY;

        noStroke();
        fill(240);
        drawingContext.shadowBlur = 30;
        drawingContext.shadowColor = "white";
        circle(moonX, moonY, 50);
        drawingContext.shadowBlur = 0;
    }
}

function drawGround() {
    fill(101, 67, 33);
    noStroke();
    rect(0, height - 120, width, 120);
}

// --- Fractal Root System ---
class RootBranch {
    constructor(x, y, angle, weight, len) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.weight = weight;
        this.len = len;
        this.children = [];
        this.endX = this.x + cos(radians(this.angle)) * this.len;
        this.endY = this.y + sin(radians(this.angle)) * this.len;

        if (this.weight > 0.5) {
            let numChildren = floor(random(1, 4));
            for (let i = 0; i < numChildren; i++) {
                let newWeight = this.weight * 0.7;
                let newLen = this.len * random(0.7, 0.9);
                let angleOffset = random(-35, 35);
                if (this.weight < 2) angleOffset = random(-50, 50);
                this.children.push(new RootBranch(
                    this.endX, this.endY, this.angle + angleOffset, newWeight, newLen
                ));
            }
        }
    }
}

function drawFractalRoots(node, energy) {
    if (energy <= 0) return;
    stroke(210, 180, 140);
    strokeWeight(node.weight);
    strokeCap(ROUND);
    noFill();
    line(node.x, node.y, node.endX, node.endY);
    let cost = node.len;
    let remainingEnergy = energy - cost;
    if (remainingEnergy > 0 && node.children.length > 0) {
        for (let child of node.children) {
            drawFractalRoots(child, remainingEnergy);
        }
    }
}

// --- Tree & Other Visuals ---
function drawOrganicPlant(growth) {
    let scaleFactor = map(growth, 0, 200, 0.2, 1.5);
    scale(scaleFactor);
    let sway = sin(frameCount * 0.02) * 5;

    stroke(85, 139, 47); strokeCap(ROUND); strokeWeight(15); noFill();
    beginShape(); vertex(0, 0); bezierVertex(0, -50, sway / 2, -100, sway, -150); endShape();

    if (growth > 20) drawLeaf(0, -40, -45 + sway * 0.2, 1.0);
    if (growth > 30) drawLeaf(0, -80, 45 + sway * 0.2, 1.2);
    if (growth > 50) drawLeaf(sway / 2, -110, -30 + sway * 0.3, 1.4);
    if (growth > 80) drawLeaf(sway, -150, 0 + sway * 0.5, 1.5);

    if (growth > 100) {
        push(); translate(0, -60); rotate(PI / 4); strokeWeight(10); line(0, 0, 0, -40); translate(0, -40); drawLeaf(0, 0, 0, 1.0);
        if (growth > 120) drawFlower(0, 0, growth); pop();

        push(); translate(0, -90); rotate(-PI / 3); strokeWeight(8); line(0, 0, 0, -30); translate(0, -30); drawLeaf(0, 0, 10, 0.9);
        if (growth > 140) drawFlower(0, 0, growth); pop();

        if (growth > 160) { push(); translate(sway, -150); drawFlower(0, -10, growth); pop(); }
    }
}

function drawLeaf(x, y, angleDeg, sizeScale) {
    push(); translate(x, y); rotate(radians(angleDeg)); scale(sizeScale);
    let c1 = color(100, 200, 100);
    if (state.limitingFactor !== 'None' && state.growthRate < 50) c1 = color(200, 180, 50);
    noStroke(); fill(c1);
    beginShape(); vertex(0, 0); bezierVertex(15, -10, 15, -40, 0, -60); bezierVertex(-15, -40, -15, -10, 0, 0); endShape();
    stroke(0, 50, 0, 50); strokeWeight(1); line(0, 0, 0, -55);
    pop();
}

function drawFlower(x, y, growth) {
    let bloomSize = map(growth, 120, 200, 0, 1, true);
    if (bloomSize <= 0) return;
    push(); translate(x, y); scale(bloomSize);
    fill(255, 105, 180); noStroke();
    for (let i = 0; i < 6; i++) { rotate(PI / 3); ellipse(0, -10, 10, 20); }
    fill(255, 215, 0); circle(0, 0, 10); pop();
}

class GrassBlade {
    constructor(x) { this.x = x; this.h = random(15, 30); this.angleOffset = random(0, 100); }
    display() {
        let tempDiff = Math.abs(state.temp - OPTIMAL_TEMP);
        let r, g, b;
        let hc = { r: 88, g: 180, b: 71 }; let dc = { r: 210, g: 180, b: 60 };
        if (tempDiff < 10) { fill(hc.r, hc.g, hc.b); } else {
            let amt = map(tempDiff, 10, 25, 0, 1, true);
            r = lerp(hc.r, dc.r, amt); g = lerp(hc.g, dc.g, amt); b = lerp(hc.b, dc.b, amt);
            fill(r, g, b);
        }
        noStroke();
        let tipX = this.x + sin(frameCount * 0.05 + this.angleOffset) * 5;
        let baseY = height - 120;
        beginShape(); vertex(this.x - 2, baseY); vertex(this.x + 2, baseY); vertex(tipX, baseY - this.h); endShape();
    }
}

class Bubble {
    constructor(x, y) { this.x = x + random(-10, 10); this.y = y + random(-10, 10); this.vx = random(-0.5, 0.5); this.vy = random(-1, -2.5); this.size = random(4, 8); this.alpha = 255; }
    update() { this.x += this.vx; this.x += sin(frameCount * 0.1) * 0.5; this.y += this.vy; this.alpha -= 2; }
    display() { noFill(); stroke(200, 240, 255, this.alpha); strokeWeight(1.5); circle(this.x, this.y, this.size); noStroke(); fill(255, 255, 255, this.alpha); circle(this.x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.3); }
    isDead() { return this.alpha < 0; }
}

class WaterParticle {
    constructor() { this.reset(); }
    reset() { this.x = random(width / 2 - 60, width / 2 + 60); this.y = random(height - 20, height - 120); this.speed = random(0.5, 1.5); this.active = true; }
    update() {
        let targetX = width / 2; let targetY = height - 120;
        let dx = targetX - this.x; let dy = targetY - this.y;
        let dist = sqrt(dx * dx + dy * dy);
        this.x += (dx / dist) * this.speed; this.y += (dy / dist) * this.speed;
        if (dist < 10) this.reset();
    }
    display() { fill(100, 200, 255, 150); noStroke(); circle(this.x, this.y, 4); }
}

class Firefly {
    constructor() { this.x = random(width); this.y = random(height * 0.5, height - 100); this.t = random(1000); this.size = random(2, 5); }
    update() { this.x += noise(this.t) - 0.5; this.y += noise(this.t + 100) - 0.5; this.t += 0.01; }
    display(opacityMult) {
        let glow = (sin(frameCount * 0.1 + this.t) + 1) / 2; let alpha = 200 * opacityMult * glow;
        fill(255, 255, 100, alpha); noStroke(); circle(this.x, this.y, this.size);
        fill(255, 255, 100, alpha * 0.3); circle(this.x, this.y, this.size * 3);
    }
}

class Particle {
    constructor() { this.reset(); }
    reset() { this.x = random(width); this.y = random(height - 50, height - 150); this.vx = random(-0.2, 0.2); this.vy = random(-0.5, -1.0); this.alpha = random(50, 150); this.size = random(2, 5); }
    update() { this.y += this.vy; this.x += this.vx; this.alpha -= 0.5; if (this.alpha < 0) this.reset(); }
    display() { fill(255, 255, 255, this.alpha); noStroke(); circle(this.x, this.y, this.size); }
}

class Cloud {
    constructor() { this.x = random(width); this.y = random(height * 0.1, height * 0.3); this.speed = random(0.2, 0.5); }
    update() { this.x += this.speed; if (this.x > width + 100) this.x = -100; }
    display() { fill(255, 255, 255, 200); noStroke(); circle(this.x, this.y, 60); circle(this.x + 40, this.y + 10, 70); circle(this.x - 30, this.y + 15, 50); }
}

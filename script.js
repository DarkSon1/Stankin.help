let graphData = null;
let currentStep = 0;
let currentPathSteps = [];

async function loadGraphData() {
    const res = await fetch('data/graph.json?v=' + Date.now());
    graphData = await res.json();
    setupAutocomplete();
}

function setupAutocomplete() {
    const datalist = document.getElementById('auditories-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    // Собираем все ключи из coordinates
    Object.keys(graphData.coordinates).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
}

function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;
    // Используем поля building и floor из JSON
    return `/assets/maps/${c.building}_${c.floor}.jpg`;
}

function findPath(start, end) {
    const paths = graphData.paths;
    const distances = graphData.distances || {};
    const pq = [{ node: start, dist: 0, path: [start] }];
    const visitedDist = { [start]: 0 };

    while (pq.length) {
        pq.sort((a, b) => a.dist - b.dist);
        const { node, dist, path } = pq.shift();
        if (node === end) return path;
        if (visitedDist[node] !== undefined && visitedDist[node] < dist) continue;

        let neighbors = paths[node] || [];
        for (const next of neighbors) {
            const newDist = dist + (distances[`${node}->${next}`] || 1);
            if (visitedDist[next] === undefined || newDist < visitedDist[next]) {
                visitedDist[next] = newDist;
                pq.push({ node: next, dist: newDist, path: [...path, next] });
            }
        }
    }
    return null;
}

function splitPathByImages(path) {
    const steps = [];
    let currentStepNodes = [path[0]];

    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        if (getImageForNode(from) === getImageForNode(to)) {
            currentStepNodes.push(to);
        } else {
            steps.push({ nodes: currentStepNodes, image: getImageForNode(from) });
            currentStepNodes = [to];
        }
    }
    steps.push({ nodes: currentStepNodes, image: getImageForNode(currentStepNodes[0]) });
    return steps;
}

function drawStep(container, step, isFirst, isLast) {
    const nodes = step.nodes;
    const imageSrc = step.image;
    
    container.innerHTML = '';
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 10;
        ctx.beginPath();
        nodes.forEach((node, i) => {
            const pos = graphData.coordinates[node];
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();
        container.appendChild(canvas);

        // Кнопки
        const nav = document.createElement('div');
        nav.className = 'nav-buttons';
        
        if (!isFirst) {
            const btnBack = document.createElement('button');
            btnBack.className = 'back';
            btnBack.textContent = '← Назад';
            btnBack.onclick = () => { currentStep--; showStep(); };
            nav.appendChild(btnBack);
        }

        if (!isLast) {
            const btnNext = document.createElement('button');
            btnNext.textContent = 'Дальше →';
            btnNext.onclick = () => { currentStep++; showStep(); };
            nav.appendChild(btnNext);
        } else {
            const btnFinish = document.createElement('button');
            btnFinish.className = 'finish';
            btnFinish.textContent = '🏁 Финиш';
            btnFinish.onclick = () => { 
                document.getElementById('result').style.display = 'none'; 
                currentStep = 0;
            };
            nav.appendChild(btnFinish);
        }
        container.appendChild(nav);
    };
}

function showStep() {
    const container = document.getElementById('mapContainer');
    drawStep(container, currentPathSteps[currentStep], currentStep === 0, currentStep === currentPathSteps.length - 1);
}

document.getElementById('findBtn').addEventListener('click', async () => {
    const from = document.getElementById('from').value.trim();
    const to = document.getElementById('to').value.trim();
    if (!graphData) await loadGraphData();
    const path = findPath(from, to);
    if (!path) return alert('Маршрут не найден');
    currentPathSteps = splitPathByImages(path);
    currentStep = 0;
    document.getElementById('result').style.display = 'block';
    showStep();
});

loadGraphData();

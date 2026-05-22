let graphData = null;
let currentStep = 0;
let currentPathSteps = [];

async function loadGraphData() {
    const res = await fetch(`data/graph.json?v=${Date.now()}`);
    graphData = await res.json();
    setupAutocomplete();
}

function setupAutocomplete() {
    const allRooms = graphData.buildings.new.floors["2"];
    const datalist = document.getElementById('auditories-list');
    datalist.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
}

function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;
    if (c.building === 'new') return `/assets/maps/new_${c.floor}.jpg`;
    return null;
}

function findPath(start, end) {
    const paths = graphData.paths;
    const distances = graphData.distances || {};
    const isAuditory = (node) => /^\d{4}$/.test(node);
    const getExit = (node) => `exit_${node}`;

    const pq = [{ node: start, dist: 0, path: [start] }];
    const visitedDist = { [start]: 0 };

    while (pq.length) {
        pq.sort((a, b) => a.dist - b.dist);
        const { node, dist, path } = pq.shift();
        if (node === end) return path;

        if (visitedDist[node] !== undefined && visitedDist[node] < dist) continue;

        let neighbors = paths[node] || [];

        if (isAuditory(node)) {
            const expectedExit = getExit(node);
            neighbors = neighbors.filter(n => n === expectedExit);
        }

        for (const next of neighbors) {
            const edgeKey = `${node}->${next}`;
            const edgeDist = distances[edgeKey] || 1;
            const newDist = dist + edgeDist;

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
    for (let i = 0; i < path.length - 1; i++) {
        steps.push({
            from: path[i],
            to: path[i + 1],
            image: getImageForNode(path[i])
        });
    }
    return steps;
}

function drawStep(container, fromNode, toNode, imageSrc, isFirst, isLast, onNext) {
    const fromCoord = graphData.coordinates[fromNode];
    const toCoord = graphData.coordinates[toNode];
    if (!fromCoord || !toCoord) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        container.innerHTML = '';

        const maxWidth = Math.min(img.width, window.innerWidth - 40, 1200);
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = (img.height / img.width) * maxWidth;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.touchAction = 'pinch-zoom';

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;

        const fromX = fromCoord.x * scaleX;
        const fromY = fromCoord.y * scaleY;
        const toX = toCoord.x * scaleX;
        const toY = toCoord.y * scaleY;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.font = 'bold 16px sans-serif';
        if (isFirst) {
            ctx.fillStyle = '#2196F3';
            ctx.fillText('🚩 Вы', fromX + 10, fromY - 6);
        }
        if (isLast) {
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('🏁', toX + 10, toY - 6);
        }

        container.appendChild(canvas);

        if (onNext) {
            const btn = document.createElement('button');
            btn.textContent = '→ Дальше';
            btn.style.marginTop = '16px';
            btn.onclick = onNext;
            container.appendChild(btn);
        }
    };
}

function startNavigation(start, end) {
    const path = findPath(start, end);
    if (!path) {
        alert('Маршрут не найден');
        return;
    }
    currentPathSteps = splitPathByImages(path);
    currentStep = 0;
    showStep();
}

function showStep() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    const step = currentPathSteps[currentStep];
    if (!step) return;

    const isFirst = currentStep === 0;
    const isLast = currentStep === currentPathSteps.length - 1;

    drawStep(container, step.from, step.to, step.image, isFirst, isLast, () => {
        if (currentStep + 1 < currentPathSteps.length) {
            currentStep++;
            showStep();
        }
    });
}

document.getElementById('findBtn').addEventListener('click', async () => {
    const from = document.getElementById('from').value.trim();
    const to = document.getElementById('to').value.trim();
    if (!from || !to) return alert('Введите обе аудитории');
    if (!graphData) await loadGraphData();
    startNavigation(from, to);
    document.getElementById('result').style.display = 'block';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    document.getElementById('result').style.display = 'none';
    document.getElementById('mapContainer').innerHTML = '';
    currentPathSteps = [];
    currentStep = 0;
});

loadGraphData();

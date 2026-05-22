let graphData = null;
let currentStep = 0;
let currentPathNodes = [];
let currentPathSteps = [];

async function loadGraphData() {
    const res = await fetch('data/graph.json');
    graphData = await res.json();
    setupAutocomplete();
}

function setupAutocomplete() {
    const allRooms = [];
    for (let f in graphData.buildings.new.floors)
        allRooms.push(...graphData.buildings.new.floors[f]);
    for (let w in graphData.buildings.old?.wings || {})
        for (let f in graphData.buildings.old.wings[w].floors)
            allRooms.push(...graphData.buildings.old.wings[w].floors[f]);

    let datalist = document.getElementById('auditories-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'auditories-list';
        document.body.appendChild(datalist);
    }
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
    if (c.building === 'old') return `/assets/maps/old_${c.floor}A.jpg`;
    return null;
}

function findPath(start, end) {
    const paths = graphData.paths;
    const queue = [[start]];
    const visited = new Set();
    while (queue.length) {
        const path = queue.shift();
        const node = path[path.length - 1];
        if (node === end) return path;
        if (visited.has(node)) continue;
        visited.add(node);
        for (const next of paths[node] || []) {
            if (!visited.has(next)) queue.push([...path, next]);
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
        const imgFrom = getImageForNode(from);
        const imgTo = getImageForNode(to);

        if (imgFrom === imgTo) {
            currentStepNodes.push(to);
        } else {
            if (currentStepNodes.length >= 2) {
                steps.push({
                    from: currentStepNodes[0],
                    to: currentStepNodes[currentStepNodes.length - 1],
                    image: imgFrom
                });
            }
            currentStepNodes = [from, to];
        }
    }

    if (currentStepNodes.length >= 2) {
        steps.push({
            from: currentStepNodes[0],
            to: currentStepNodes[currentStepNodes.length - 1],
            image: getImageForNode(currentStepNodes[0])
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

// Обработчики
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

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

loadGraphData();

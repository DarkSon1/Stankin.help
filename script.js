let graphData = null;
let currentStep = 0;
let currentPathSteps = [];

async function loadGraphData() {
    const res = await fetch('data/graph.json');
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

        // Рисуем путь
        const path = currentPathSteps.flatMap(step => [step.from, step.to]);
        const uniquePath = [...new Map(path.map(p => [p, p])).values()];
        
        for (let i = 0; i < uniquePath.length - 1; i++) {
            const from = graphData.coordinates[uniquePath[i]];
            const to = graphData.coordinates[uniquePath[i + 1]];
            if (!from || !to) continue;
            const fromX = from.x * scaleX;
            const fromY = from.y * scaleY;
            const toX = to.x * scaleX;
            const toY = to.y * scaleY;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Рисуем синие круги на всех точках
        for (let node of uniquePath) {
            const coord = graphData.coordinates[node];
            if (!coord) continue;
            const x = coord.x * scaleX;
            const y = coord.y * scaleY;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = '#0066ff';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.fillText(node.slice(-4), x - 15, y - 5);
        }

        // 🚩 и 🏁
        const firstNode = uniquePath[0];
        const lastNode = uniquePath[uniquePath.length - 1];
        const firstCoord = graphData.coordinates[firstNode];
        const lastCoord = graphData.coordinates[lastNode];
        if (firstCoord) {
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#2196F3';
            ctx.fillText('🚩 Вы', firstCoord.x * scaleX + 10, firstCoord.y * scaleY - 6);
        }
        if (lastCoord) {
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('🏁', lastCoord.x * scaleX + 10, lastCoord.y * scaleY - 6);
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
    // Временный жёсткий путь по коридорам
    const hardcodedPath = [
        "0208",
        "exit_0208",
        "cor_627_339",
        "cor_627_211",
        "cor_816_211",
        "cor_816_340",
        "cor_994_340",
        "exit_0204",
        "0204"
    ];
    currentPathSteps = splitPathByImages(hardcodedPath);
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

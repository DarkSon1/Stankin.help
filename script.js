let graphData = null;
let currentStep = 0;
let currentPathSteps = [];
let currentFullPath = null; // сохраняем весь путь для навигации

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
        document.getElementById(`${tabId}Tab`).style.display = 'block';
    });
});

// ========== ЗАГРУЗКА ГРАФА ==========
async function loadGraphData() {
    try {
        const res = await fetch('data/graph.json?v=' + Date.now());
        graphData = await res.json();
        setupAutocomplete();
    } catch (e) {
        console.error('Ошибка загрузки графа:', e);
    }
}

// ========== АВТОКОМПЛИТ ==========
function setupAutocomplete() {
    const allRooms = Object.keys(graphData.coordinates).filter(k => /^\d{4}$/.test(k));
    const datalist = document.getElementById('auditories-list');
    datalist.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
}

// ========== КАРТИНКА ДЛЯ УЗЛА ==========
function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;
    if (c.building === 'new') return `/assets/maps/new_${c.floor}.jpg`;
    if (c.building === 'old_A') return `/assets/maps/old_A${c.floor}.jpg`;
    if (c.building === 'old_B') return `/assets/maps/old_B${c.floor}.jpg`;
    if (c.building === 'transition') return `/assets/maps/transition_new_old.jpg`;
    return null;
}

// ========== АЛГОРИТМ ДЕЙКСТРЫ ==========
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
        const neighbors = paths[node] || [];
        for (const next of neighbors) {
            const edge1 = `${node}-${next}`;
            const edge2 = `${next}-${node}`;
            const edgeDist = distances[edge1] !== undefined ? distances[edge1] : 
                             (distances[edge2] !== undefined ? distances[edge2] : 1);
            const newDist = dist + edgeDist;
            if (visitedDist[next] === undefined || newDist < visitedDist[next]) {
                visitedDist[next] = newDist;
                pq.push({ node: next, dist: newDist, path: [...path, next] });
            }
        }
    }
    return null;
}

// ========== РАЗБИВКА ПУТИ ПО КАРТИНКАМ ==========
function splitPathByImages(path) {
    if (!path || path.length === 0) return [];
    const steps = [];
    let currentNodes = [path[0]];
    let currentImg = getImageForNode(path[0]);

    for (let i = 1; i < path.length; i++) {
        const node = path[i];
        const img = getImageForNode(node);
        if (img === currentImg) {
            currentNodes.push(node);
        } else {
            currentNodes.push(node);
            steps.push({ nodes: [...currentNodes], image: currentImg });
            currentNodes = [node];
            currentImg = img;
        }
    }
    if (currentNodes.length > 1) {
        steps.push({ nodes: currentNodes, image: currentImg });
    }
    return steps;
}

// ========== ОТРИСОВКА ШАГА ==========
function drawStep(container, nodes, imageSrc, isFirst, isLast, onNext) {
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

        ctx.beginPath();
        let firstDrawn = false;
        let lastX = 0, lastY = 0;
        nodes.forEach((node) => {
            const coord = graphData.coordinates[node];
            if (coord) {
                const x = coord.x * scaleX;
                const y = coord.y * scaleY;
                if (!firstDrawn) {
                    ctx.moveTo(x, y);
                    firstDrawn = true;
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x;
                lastY = y;
            }
        });
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.font = 'bold 26px sans-serif';
        if (isFirst && nodes.length) {
            const firstCoord = graphData.coordinates[nodes[0]];
            if (firstCoord) {
                ctx.fillStyle = '#2196F3';
                ctx.fillText('🚩', firstCoord.x * scaleX - 15, firstCoord.y * scaleY - 15);
            }
        }
        if (isLast && nodes.length) {
            const lastCoord = graphData.coordinates[nodes[nodes.length - 1]];
            if (lastCoord) {
                ctx.fillStyle = '#4CAF50';
                ctx.fillText('🏁', lastCoord.x * scaleX - 15, lastCoord.y * scaleY - 15);
            }
        }
        container.appendChild(canvas);
        if (onNext) {
            const btn = document.createElement('button');
            btn.textContent = '→ Переход на следующий этаж/корпус';
            btn.style.marginTop = '16px';
            btn.onclick = onNext;
            container.appendChild(btn);
        }
    };
}

// ========== УПРАВЛЕНИЕ МАРШРУТОМ ==========
function startNavigation(start, end) {
    const path = findPath(start, end);
    if (!path) {
        alert('Не удалось проложить маршрут! Проверьте, связаны ли эти точки в graph.json.');
        return;
    }
    currentFullPath = path;
    currentPathSteps = splitPathByImages(path);
    currentStep = 0;
    updateRouteControls();
    showStep();
}

function showStep() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    const step = currentPathSteps[currentStep];
    if (!step) return;
    const isFirst = currentStep === 0;
    const isLast = currentStep === currentPathSteps.length - 1;
    drawStep(container, step.nodes, step.image, isFirst, isLast, () => {
        if (currentStep + 1 < currentPathSteps.length) {
            currentStep++;
            showStep();
            updateRouteControls();
        }
    });
}

function updateRouteControls() {
    const controlsDiv = document.getElementById('routeControls');
    if (!controlsDiv) return;
    if (currentPathSteps.length > 1) {
        controlsDiv.style.display = 'flex';
    } else {
        controlsDiv.style.display = 'none';
    }
}

function goToPrevStep() {
    if (currentStep > 0) {
        currentStep--;
        showStep();
        updateRouteControls();
    }
}

function goToNextStep() {
    if (currentStep + 1 < currentPathSteps.length) {
        currentStep++;
        showStep();
        updateRouteControls();
    }
}

function finishRoute() {
    if (currentPathSteps.length > 0) {
        currentStep = currentPathSteps.length - 1;
        showStep();
        updateRouteControls();
    }
}

// ========== ОБРАБОТЧИКИ ==========
document.getElementById('findBtn').addEventListener('click', async () => {
    const from = document.getElementById('from').value.trim();
    const to = document.getElementById('to').value.trim();
    if (!from || !to) return alert('Пожалуйста, введите обе аудитории');
    if (!graphData.coordinates[from] || !graphData.coordinates[to]) {
        return alert('Одной из аудиторий нет в базе данных навигатора');
    }
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
    currentFullPath = null;
    document.getElementById('routeControls').style.display = 'none';
});

document.getElementById('prevStepBtn')?.addEventListener('click', goToPrevStep);
document.getElementById('nextStepBtn')?.addEventListener('click', goToNextStep);
document.getElementById('finishStepBtn')?.addEventListener('click', finishRoute);

loadGraphData();

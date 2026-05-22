let graphData = null;
let currentStep = 0;
let currentPathSteps = [];

async function loadGraphData() {
    const res = await fetch('data/graph.json?v=' + Date.now());
    graphData = await res.json();
    setupAutocomplete();
}

function setupAutocomplete() {
    // Собираем все аудитории (ключи из 4 цифр) для выпадающего списка
    const allRooms = Object.keys(graphData.coordinates).filter(k => /^\d{4}$/.test(k));
    const datalist = document.getElementById('auditories-list');
    datalist.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
}

// Поддержка разных корпусов и этажей
function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;
    if (c.building === 'new') return `/assets/maps/new_${c.floor}.jpg`;
    if (c.building === 'old_A') return `/assets/maps/old_A${c.floor}.jpg`;
    if (c.building === 'old_B') return `/assets/maps/old_B${c.floor}.jpg`;
    if (c.building === 'transition') return `/assets/maps/transition_new_old.jpg`;
    return null;
}

// Алгоритм Дейкстры (учитывает веса)
function findPath(start, end) {
    const paths = graphData.paths;
    const distances = graphData.distances || {};

    const pq = [{ node: start, dist: 0, path: [start] }];
    const visitedDist = { [start]: 0 };

    while (pq.length) {
        // Сортируем очередь для алгоритма Дейкстры (выбираем ближайший узел)
        pq.sort((a, b) => a.dist - b.dist);
        const { node, dist, path } = pq.shift();
        
        if (node === end) return path;

        if (visitedDist[node] !== undefined && visitedDist[node] < dist) continue;

        const neighbors = paths[node] || [];

        for (const next of neighbors) {
            // Ищем вес ребра в обоих направлениях
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

// Исправленная разбивка по этажам (без визуальных разрывов)
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
            // Добавляем узел перехода в текущий шаг, чтобы дорисовать линию до конца
            currentNodes.push(node);
            steps.push({ nodes: currentNodes, image: currentImg });
            
            // Начинаем следующий шаг с этой же точки
            currentNodes = [node];
            currentImg = img;
        }
    }
    
    if (currentNodes.length > 1) {
        steps.push({ nodes: currentNodes, image: currentImg });
    }
    
    return steps;
}

// Отрисовка всего маршрута (линия по всем точкам, а не напрямую сквозь стены)
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
        let firstX = 0, firstY = 0;

        // Рисуем линии через все коридорные узлы
        nodes.forEach((node) => {
            const coord = graphData.coordinates[node];
            if (coord) {
                const x = coord.x * scaleX;
                const y = coord.y * scaleY;
                if (!firstDrawn) {
                    ctx.moveTo(x, y);
                    firstX = x;
                    firstY = y;
                    firstDrawn = true;
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x;
                lastY = y;
            }
        });

        // Стилизация линии
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round'; // Сглаживание углов поворота
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.font = 'bold 16px sans-serif';
        if (isFirst && firstDrawn) {
            ctx.fillStyle = '#2196F3';
            ctx.fillText('🚩 Вы', firstX + 10, firstY - 6);
        }
        if (isLast && firstDrawn) {
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('🏁', lastX + 10, lastY - 6);
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
        alert('Маршрут не найден! Проверьте, существуют ли такие аудитории.');
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

    // Передаем массив узлов (step.nodes) вместо start/end
    drawStep(container, step.nodes, step.image, isFirst, isLast, () => {
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

// Инициализация при загрузке
loadGraphData();

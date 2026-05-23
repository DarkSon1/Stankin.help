let graphData = null;
let currentStep = 0;
let currentPathSteps = [];

// 1. Загрузка графа
async function loadGraphData() {
    try {
        const res = await fetch('data/graph.json?v=' + Date.now());
        graphData = await res.json();
        setupAutocomplete();
    } catch (e) {
        console.error('Ошибка загрузки графа:', e);
    }
}

// 2. Настройка автокомплита (ищет все 4-значные аудитории)
function setupAutocomplete() {
    const allRooms = Object.keys(graphData.coordinates).filter(k => !k.includes('_') && k !== 'transition_to_old');
    const datalist = document.getElementById('auditories-list');
    datalist.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
}

// 3. Получение правильной картинки в зависимости от корпуса и этажа
function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;
    if (c.building === 'new') return `/assets/maps/new_${c.floor}.jpg`;
    if (c.building === 'old_A') return `/assets/maps/old_A${c.floor}.jpg`;
    if (c.building === 'old_B') return `/assets/maps/old_B${c.floor}.jpg`;
    if (c.building === 'transition') return `/assets/maps/transition_new_old.jpg`;
    return null;
}

// 4. Алгоритм Дейкстры (ищет путь с минимальным весом)
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
            // Проверяем вес ребра в обе стороны
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
    return null; // Путь не найден
}

// 5. Разбивка пути на этажи/картинки (сохраняет связность на лестницах/переходах)
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
            // Завершаем текущий кусок точкой перехода
            currentNodes.push(node);
            steps.push({ nodes: currentNodes, image: currentImg });
            
            // Начинаем новый кусок с этой же точки
            currentNodes = [node];
            currentImg = img;
        }
    }
    
    if (currentNodes.length > 1) {
        steps.push({ nodes: currentNodes, image: currentImg });
    }
    
    return steps;
}

// 6. Отрисовка маршрута
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

        // Рисуем ломаную линию через все узлы массива
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

        // Настройки линии
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round'; 
        ctx.lineCap = 'round';
        ctx.stroke();

        // Рисуем флажки
        ctx.font = 'bold 20px sans-serif';
        if (isFirst && firstDrawn) {
            ctx.fillText('🚩', firstX - 10, firstY - 10);
        }
        if (isLast && firstDrawn) {
            ctx.fillText('🏁', lastX - 10, lastY - 10);
        }

        container.appendChild(canvas);

        // Кнопка перехода на следующий этаж
        if (onNext) {
            const btn = document.createElement('button');
            btn.textContent = '→ Переход на следующий этаж/корпус';
            btn.style.marginTop = '16px';
            btn.onclick = onNext;
            container.appendChild(btn);
        }
    };
}

// 7. Управление интерфейсом
function startNavigation(start, end) {
    const path = findPath(start, end);
    if (!path) {
        alert('Не удалось проложить маршрут! Проверьте, связаны ли эти точки в graph.json.');
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
});
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
// Запускаем при открытии страницы
loadGraphData();

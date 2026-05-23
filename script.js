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

// 2. Логика модального окна выбора аудиторий
let currentInputTarget = null;

const buildingNames = {
    'new': 'Новый корпус',
    'old_A': 'Старый корпус А',
    'old_B': 'Старый корпус Б',
    'transition': 'Переход'
};

function setupAutocomplete() {
    const fromInput = document.getElementById('from');
    const toInput = document.getElementById('to');

    // Привязываем открытие окна к клику по полям
    fromInput.addEventListener('click', () => openModal('from'));
    toInput.addEventListener('click', () => openModal('to'));

    // Кнопка закрытия окна
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    
    // Живой поиск при вводе
    document.getElementById('roomSearchInput').addEventListener('input', renderRoomList);
    
    // Закрытие при клике мимо окна (по темному фону)
    document.getElementById('roomSelectorModal').addEventListener('click', (e) => {
        if (e.target.id === 'roomSelectorModal') closeModal();
    });
}

function openModal(target) {
    currentInputTarget = target;
    document.getElementById('modalTitle').textContent = target === 'from' ? '📍 Откуда идем?' : '🎯 Куда идем?';
    document.getElementById('roomSearchInput').value = '';
    document.getElementById('roomSelectorModal').classList.add('active');
    renderRoomList();
    
    // Автофокус на поле поиска с задержкой (полезно для мобилок)
    setTimeout(() => document.getElementById('roomSearchInput').focus(), 100);
}

function closeModal() {
    document.getElementById('roomSelectorModal').classList.remove('active');
}

function renderRoomList() {
    const container = document.getElementById('roomListContainer');
    const searchQuery = document.getElementById('roomSearchInput').value.toLowerCase().trim();
    container.innerHTML = '';

    // Берем все ключи графа и оставляем только те, что похожи на аудитории 
    // (Исключаем служебные: cor_, exit_, stairs_, transition_ и т.д.)
    const rooms = Object.keys(graphData.coordinates).filter(k => 
        !k.startsWith('cor_') && !k.startsWith('exit_') && !k.startsWith('stairs_')
    );

    const groups = {};

    rooms.forEach(room => {
        // Фильтр поиска по названию аудитории
        if (searchQuery && !room.toLowerCase().includes(searchQuery)) return;

        const c = graphData.coordinates[room];
        const bName = buildingNames[c.building] || 'Неизвестный корпус';
        // Формируем заголовок группы, например: "Новый корпус, 2 этаж"
        const groupName = `${bName}, ${c.floor} этаж`;

        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(room);
    });

    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; margin-top: 20px;">Ничего не найдено 😔</div>';
        return;
    }

    // Рисуем списки по группам
    for (const [groupName, groupRooms] of Object.entries(groups)) {
        const title = document.createElement('div');
        title.className = 'room-group-title';
        title.textContent = groupName;
        container.appendChild(title);

        // Сортируем аудитории по алфавиту/цифрам
        groupRooms.sort().forEach(room => {
            const item = document.createElement('div');
            item.className = 'room-item';
            
            // Если в графе ключ называется "ТП-8_ЛТТО_ЦТМ", он так и выведется
            item.textContent = room; 
            
            item.onclick = () => {
                document.getElementById(currentInputTarget).value = room;
                closeModal();
            };
            container.appendChild(item);
        });
    }
}

// 3. Получение правильной картинки в зависимости от корпуса и этажа
function getImageForNode(node) {
    const c = graphData.coordinates[node];
    if (!c) return null;

    // Новый корпус: подставляет этаж, получается new_1.jpg или new_2.jpg
    if (c.building === 'new') return `assets/maps/new_${c.floor}.jpg`;
    
    // Старый корпус А: подставляет этаж, получается old_1A.jpg или old_2A.jpg
    if (c.building === 'old_A') return `assets/maps/old_${c.floor}A.jpg`;
    
    // Переход: жестко заданный путь с правильным форматом .png
    if (c.building === 'transition') return `assets/maps/transition_new_old.png`;
    
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

// 5. Разбивка пути на этажи/картинки (ИСПРАВЛЕННАЯ)
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
            // Картинка сменилась! Сохраняем старый маршрут БЕЗ чужой точки
            steps.push({ nodes: currentNodes, image: currentImg });
            
            // Начинаем новый шаг с новой точки
            currentNodes = [node];
            currentImg = img;
        }
    }
    
    if (currentNodes.length > 0) {
        steps.push({ nodes: currentNodes, image: currentImg });
    }
    
    return steps;
}

// 6. Отрисовка маршрута с кнопками (ИСПРАВЛЕННАЯ)
function drawStep(container, nodes, imageSrc, isFirst, isLast, onNext, onPrev, onFinish) {
    const img = new Image();
    
    // Если картинка не найдена, покажем ошибку, чтобы кнопка "не зависала" молча
    img.onerror = () => {
        alert(`Ошибка: Не могу загрузить карту!\nСкрипт ищет файл по пути: ${imageSrc}\nПроверь, как точно называется эта картинка в папке /assets/maps/!`);
    };

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

        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round'; 
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.font = 'bold 20px sans-serif';
        if (isFirst && firstDrawn) ctx.fillText('🚩', firstX - 10, firstY - 10);
        if (isLast && firstDrawn) ctx.fillText('🏁', lastX - 10, lastY - 10);

        container.appendChild(canvas);

        const navBar = document.createElement('div');
        navBar.style.display = 'flex';
        navBar.style.justifyContent = 'center';
        navBar.style.gap = '10px';
        navBar.style.marginTop = '15px';
        navBar.style.width = '100%';

        if (!isFirst) {
            const btnPrev = document.createElement('button');
            btnPrev.textContent = '← Назад';
            btnPrev.style.background = '#ff9f43';
            btnPrev.style.flex = '1';
            btnPrev.onclick = onPrev;
            navBar.appendChild(btnPrev);
        }

        if (!isLast) {
            const btnNext = document.createElement('button');
            btnNext.textContent = 'Дальше →';
            btnNext.style.flex = '1';
            btnNext.onclick = onNext;
            navBar.appendChild(btnNext);
        } else {
            const btnFinish = document.createElement('button');
            btnFinish.textContent = '🏁 Финиш';
            btnFinish.style.background = '#ff6b6b';
            btnFinish.style.flex = '1';
            btnFinish.onclick = onFinish;
            navBar.appendChild(btnFinish);
        }

        container.appendChild(navBar);
    };
}

// 7. Управление интерфейсом и переключением шагов
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

    // Передаем в drawStep функции для каждой кнопки
    drawStep(
        container, 
        step.nodes, 
        step.image, 
        isFirst, 
        isLast, 
        // Логика кнопки "Дальше"
        () => {
            if (currentStep + 1 < currentPathSteps.length) {
                currentStep++;
                showStep();
            }
        },
        // Логика кнопки "Назад"
        () => {
            if (currentStep > 0) {
                currentStep--;
                showStep();
            }
        },
        // Логика кнопки "Финиш"
        () => {
            document.getElementById('result').style.display = 'none';
            document.getElementById('from').value = '';
            document.getElementById('to').value = '';
            currentPathSteps = [];
            currentStep = 0;
            // Можно убрать alert, если он раздражает, но он дает понять, что маршрут окончен
            alert('Маршрут успешно завершен!'); 
        }
    );
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

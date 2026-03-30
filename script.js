// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let graphData = null;

// ========== ЗАГРУЗКА JSON ==========
async function loadGraphData() {
    try {
        const response = await fetch('data/graph.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        graphData = await response.json();
        console.log('✅ Данные загружены:', graphData);
        return true;
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        return false;
    }
}

// ========== ПОИСК АУДИТОРИИ В ДАННЫХ ==========
function findAuditory(roomNumber) {
    if (!graphData) return null;
    roomNumber = roomNumber.trim();
    
    // Новый корпус (0205)
    if (roomNumber.length === 4 && roomNumber[0] === '0') {
        const floor = parseInt(roomNumber[1]);
        const rooms = graphData.buildings.new.auditories[floor];
        if (rooms && rooms.includes(roomNumber)) {
            return {
                building: 'new',
                wing: null,
                floor: floor,
                room: roomNumber,
                isValid: true
            };
        }
    }
    
    // Старый корпус (205) — пока заглушка
    if (roomNumber.length === 3 && roomNumber[0] !== '0') {
        return null;
    }
    
    return null;
}

// ========== ПАРСИНГ НОМЕРА ==========
async function parseRoomNumberWithData(room) {
    room = room.trim();
    if (!graphData) await loadGraphData();
    
    const found = findAuditory(room);
    if (!found) {
        return {
            original: room,
            isValid: false,
            error: `Аудитория ${room} не найдена в базе`
        };
    }
    
    if (found.building === 'new') {
        return {
            original: room,
            building: 'new',
            buildingName: 'Новый',
            floor: found.floor,
            number: room.substring(2),
            isValid: true,
            error: null
        };
    }
    
    return { original: room, isValid: false, error: 'Старый корпус пока в разработке' };
}

// ========== BFS: ПОИСК КРАТЧАЙШЕГО ПУТИ ==========
function findPathBFS(startNode, endNode) {
    // Временная заглушка — пока просто текст
    return {
        steps: [
            `📍 Отправление: ${startNode.buildingName} корпус, ${startNode.floor} этаж, аудитория ${startNode.original}`,
            `↑ Подняться на ${endNode.floor} этаж`,
            `✅ Прибытие: ${endNode.buildingName} корпус, ${endNode.floor} этаж, аудитория ${endNode.original}`
        ]
    };
}

// ========== ОТОБРАЖЕНИЕ МАРШРУТА ==========
async function displayRoute(from, to) {
    const resultDiv = document.getElementById('result');
    const routeTextDiv = document.getElementById('routeText');
    
    const fromInfo = await parseRoomNumberWithData(from);
    const toInfo = await parseRoomNumberWithData(to);
    
    if (!fromInfo.isValid) {
        routeTextDiv.innerHTML = `<div class="error">⚠️ ${fromInfo.error}</div>`;
        resultDiv.style.display = 'block';
        return;
    }
    if (!toInfo.isValid) {
        routeTextDiv.innerHTML = `<div class="error">⚠️ ${toInfo.error}</div>`;
        resultDiv.style.display = 'block';
        return;
    }
    
    // Если оба в Новом корпусе — строим маршрут
    if (fromInfo.building === 'new' && toInfo.building === 'new') {
        const route = findPathBFS(fromInfo, toInfo);
        let html = '';
        route.steps.forEach(step => {
            html += `<div class="route-step">${step}</div>`;
        });
        routeTextDiv.innerHTML = html;
    } else {
        routeTextDiv.innerHTML = `<div class="error">⚠️ Переход между корпусами пока в разработке</div>`;
    }
    
    resultDiv.style.display = 'block';
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
document.getElementById('findBtn').addEventListener('click', async () => {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    if (!from || !to) {
        alert('Введите обе аудитории');
        return;
    }
    await displayRoute(from, to);
});

document.getElementById('from').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('findBtn').click();
});
document.getElementById('to').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('findBtn').click();
});

// ========== ЗАГРУЗКА ПРИ СТАРТЕ ==========
loadGraphData();

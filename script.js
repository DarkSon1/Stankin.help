let graphData = null;
let currentStep = 0;
let currentSteps = [];
let selectedFrom = null;
let selectedTo = null;

const fallbackGroups = [
    { name: "Новый корпус, 1 этаж", rooms: ["0102","0103","0104","0105","0106","0161","0119","0120","0112","0113","0114"] },
    { name: "Новый корпус, 2 этаж", rooms: ["0201","0202","0203","0204","0205","0206","0207","0208","0209","0210","0211"] },
    { name: "Старый корпус А, 1 этаж", rooms: ["ТП-8 ЛТТО ЦТМ","ТП-7 ЛТИиКРИ ЦТМ","ЦЕНТР КОЛЛАБОРАТИВНОЙ РОБОТОТЕХНИКИ","ТП-5а ЦКР ЦТМ","ТП-4 ЛТМ ЦТМ","ТП-5 ЛТПДМ ЦТМ","ТП-6 ЛТГО ЦТМ","СЕРВЕРНАЯ","ЛАБОРАТОРИЯ ГИДРАВЛИКИ","135з","135и"] },
    { name: "Старый корпус А, 2 этаж", rooms: ["218","219","220","221","222","223","223а","223б","224","225","233 (ДЕКАНАТ)","234а","234б","234","235а","235б","235в","235ж","235е","235д","235г","237","238","239","СТОЛОВАЯ"] }
];

async function loadGraphData() {
    try {
        const res = await fetch('data/graph.json');
        graphData = await res.json();
    } catch(e) {
        console.warn('graph.json не загружен, используем fallback');
        graphData = null;
    }
    buildAuditoryList();
}

function buildAuditoryList() {
    if (graphData && graphData.buildings?.new?.floors) {
        window.auditoryGroups = [
            { name: "Новый корпус, 1 этаж", rooms: graphData.buildings.new.floors["1"] || [] },
            { name: "Новый корпус, 2 этаж", rooms: graphData.buildings.new.floors["2"] || [] },
            { name: "Старый корпус А, 1 этаж", rooms: graphData.buildings.old?.wings?.A?.floors?.["1"] || [] },
            { name: "Старый корпус А, 2 этаж", rooms: graphData.buildings.old?.wings?.A?.floors?.["2"] || [] }
        ];
    } else {
        window.auditoryGroups = fallbackGroups;
    }
}

function openModal(target) {
    const modal = document.getElementById('auditoryModal');
    const modalList = document.getElementById('modalList');
    modalList.innerHTML = '';

    window.auditoryGroups.forEach(group => {
        if (!group.rooms || group.rooms.length === 0) return;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'modal-group';
        groupDiv.innerHTML = `<div class="modal-group-title">${group.name}</div>`;
        group.rooms.forEach(room => {
            const item = document.createElement('div');
            item.className = 'modal-item';
            item.textContent = room;
            item.onclick = () => {
                if (target === 'from') {
                    selectedFrom = room;
                    document.querySelector('#fromTrigger .selected-value').textContent = room;
                } else {
                    selectedTo = room;
                    document.querySelector('#toTrigger .selected-value').textContent = room;
                }
                document.getElementById('findBtn').disabled = !(selectedFrom && selectedTo);
                modal.style.display = 'none';
            };
            groupDiv.appendChild(item);
        });
        modalList.appendChild(groupDiv);
    });

    modal.style.display = 'flex';
}

document.getElementById('modalSearch').addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    document.querySelectorAll('.modal-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(search) ? 'flex' : 'none';
    });
});

document.querySelector('.modal-close').onclick = () => document.getElementById('auditoryModal').style.display = 'none';
window.onclick = (e) => {
    if (e.target === document.getElementById('auditoryModal')) document.getElementById('auditoryModal').style.display = 'none';
};

document.getElementById('fromTrigger').onclick = () => openModal('from');
document.getElementById('toTrigger').onclick = () => openModal('to');

function getImageForNode(node) {
    if (!graphData || !graphData.coordinates) return null;
    const c = graphData.coordinates[node];
    if (!c) return null;
    if (c.building === 'new') return `/assets/maps/new_${c.floor}.jpg`;
    if (c.building === 'old') return `/assets/maps/old_${c.floor}A.jpg`;
    if (c.building === 'transition') return `/assets/maps/transition_old_new.png`;
    return null;
}

function drawStep(container, fromNode, toNode, imageSrc, isFirst, isLast, onNext) {
    if (!graphData) return;
    const fromCoord = graphData.coordinates[fromNode];
    const toCoord = graphData.coordinates[toNode];
    if (!fromCoord || !toCoord) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        container.innerHTML = '';
        const containerWidth = container.clientWidth - 20;
        const maxWidth = Math.min(img.width, containerWidth, 1000);
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = (img.height / img.width) * maxWidth;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        const ctx = canvas.getContext('2d');
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

function startManualRoute() {
    if (selectedFrom !== "0208" || selectedTo !== "ТП-8 ЛТТО ЦТМ") {
        const container = document.getElementById('mapContainer');
        container.innerHTML = '<div style="padding: 60px; text-align: center;">🚧 Маршрут скоро появится</div>';
        document.getElementById('result').style.display = 'block';
        return;
    }
    currentSteps = [
        { from: "0208", to: "exit_new_to_transition", image: "/assets/maps/new_2.jpg", isFirst: true, isLast: false },
        { from: "enter_transition_from_new", to: "exit_transition_to_old", image: "/assets/maps/transition_old_new.png", isFirst: false, isLast: false },
        { from: "enter_old_from_transition", to: "ТП-8 ЛТТО ЦТМ", image: "/assets/maps/old_1A.jpg", isFirst: false, isLast: true }
    ];
    currentStep = 0;
    showManualStep();
}

function showManualStep() {
    const container = document.getElementById('mapContainer');
    const step = currentSteps[currentStep];
    drawStep(container, step.from, step.to, step.image, step.isFirst, step.isLast, () => {
        if (currentStep + 1 < currentSteps.length) {
            currentStep++;
            showManualStep();
        }
    });
}

document.getElementById('findBtn').addEventListener('click', () => {
    if (!selectedFrom || !selectedTo) return alert('Выберите обе аудитории');
    startManualRoute();
    document.getElementById('result').style.display = 'block';
    document.getElementById('navBtn').click();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    selectedFrom = null;
    selectedTo = null;
    document.querySelector('#fromTrigger .selected-value').textContent = 'Выберите аудиторию';
    document.querySelector('#toTrigger .selected-value').textContent = 'Выберите аудиторию';
    document.getElementById('findBtn').disabled = true;
    document.getElementById('result').style.display = 'none';
    document.getElementById('mapContainer').innerHTML = '';
});

document.getElementById('navBtn').onclick = () => {
    document.getElementById('navigatorPanel').style.display = 'block';
    document.getElementById('mapPanel').style.display = 'none';
    document.getElementById('schedulePanel').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    ['navBtn', 'mapBtn', 'scheduleBtn'].forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById('navBtn').classList.add('active');
};
document.getElementById('mapBtn').onclick = () => {
    document.getElementById('navigatorPanel').style.display = 'none';
    document.getElementById('mapPanel').style.display = 'block';
    document.getElementById('schedulePanel').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    ['navBtn', 'mapBtn', 'scheduleBtn'].forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById('mapBtn').classList.add('active');
};
document.getElementById('scheduleBtn').onclick = () => {
    document.getElementById('navigatorPanel').style.display = 'none';
    document.getElementById('mapPanel').style.display = 'none';
    document.getElementById('schedulePanel').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    ['navBtn', 'mapBtn', 'scheduleBtn'].forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById('scheduleBtn').classList.add('active');
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
loadGraphData();

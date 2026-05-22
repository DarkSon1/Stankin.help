let graphData = null;
let currentStep = 0;
let currentSteps = [];

// Переключение вкладок
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('navigatorTab').style.display = tab === 'navigator' ? 'block' : 'none';
        document.getElementById('mapTab').style.display = tab === 'map' ? 'block' : 'none';
        document.getElementById('scheduleTab').style.display = tab === 'schedule' ? 'block' : 'none';
    });
});

async function loadGraphData() {
    const res = await fetch('data/graph.json');
    graphData = await res.json();
    setupAutocomplete();
}

function setupAutocomplete() {
    const allRooms = [];
    for (let f in graphData.buildings.new.floors)
        allRooms.push(...graphData.buildings.new.floors[f]);
    for (let w in graphData.buildings.old.wings)
        for (let f in graphData.buildings.old.wings[w].floors)
            allRooms.push(...graphData.buildings.old.wings[w].floors[f]);

    const datalist = document.getElementById('auditories-list');
    datalist.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        datalist.appendChild(opt);
    });
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

function startManualRoute() {
    currentSteps = [
        { from: "0208", to: "exit_new_to_transition", image: "/assets/maps/new_2.jpg", isFirst: true, isLast: false },
        { from: "enter_transition_from_new", to: "exit_transition_to_old", image: "/assets/maps/transition_old_new.png", isFirst: false, isLast: false },
        { from: "enter_old_from_transition", to: "ТП-8 ЛТТО ЦТМ", image: "/assets/maps/old_1A.jpg", isFirst: false, isLast: true }
    ];
    currentStep = 0;
    showStep();
}

function showStep() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    const step = currentSteps[currentStep];
    if (!step) return;

    drawStep(container, step.from, step.to, step.image, step.isFirst, step.isLast, () => {
        if (currentStep + 1 < currentSteps.length) {
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
    startManualRoute();
    document.getElementById('result').style.display = 'block';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    document.getElementById('result').style.display = 'none';
    document.getElementById('mapContainer').innerHTML = '';
    currentSteps = [];
    currentStep = 0;
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
loadGraphData();

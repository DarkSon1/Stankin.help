document.addEventListener('DOMContentLoaded', () => {
    const findBtn = document.getElementById('findBtn');
    const resetBtn = document.getElementById('resetBtn');
    const fromInput = document.getElementById('from');
    const toInput = document.getElementById('to');
    const resultDiv = document.getElementById('result');
    const mapContainer = document.getElementById('mapContainer');

    findBtn.addEventListener('click', () => {
        const from = fromInput.value.trim();
        const to = toInput.value.trim();

        if (!from || !to) {
            alert('Введите обе аудитории');
            return;
        }

        mapContainer.innerHTML = `<div style="padding:20px; text-align:center;">
            📍 Маршрут от ${from} до ${to}<br>
            (демо-версия, скоро добавим карту)
        </div>`;
        resultDiv.style.display = 'block';
    });

    resetBtn.addEventListener('click', () => {
        fromInput.value = '';
        toInput.value = '';
        resultDiv.style.display = 'none';
        mapContainer.innerHTML = '';
    });
});

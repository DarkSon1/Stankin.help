document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Скрипт загружен и работает');

    const findBtn = document.getElementById('findBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (findBtn) {
        findBtn.addEventListener('click', () => {
            alert('Кнопка "Построить маршрут" работает');
        });
    } else {
        console.error('❌ Кнопка findBtn не найдена в HTML');
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            alert('Кнопка "Сбросить маршрут" работает');
        });
    } else {
        console.error('❌ Кнопка resetBtn не найдена в HTML');
    }
});

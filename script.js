// ============================================
// КОНФИГУРАЦИЯ
// ============================================
// ЗАМЕНИТЕ НА ВАШ URL ПОСЛЕ ДЕПЛОЯ
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbygoXVdarlwZaf7bXb4jZPmZmSAUNVRXLHL6s1lNJeG3mzkGJLNJMNFF9Raw5iXwJ4I/exec";

let currentAdminPassword = "";

// ============================================
// ФУНКЦИИ ИНТЕРФЕЙСА
// ============================================

// Показать уведомление
function showToast(message, isSuccess = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + (isSuccess ? 'success' : 'error');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Переключение вкладок
function switchTab(tab) {
    const bookingTab = document.getElementById('booking-tab');
    const adminTab = document.getElementById('admin-tab');
    const tabs = document.querySelectorAll('.tab');
    
    if (tab === 'booking') {
        bookingTab.classList.add('active');
        adminTab.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        bookingTab.classList.remove('active');
        adminTab.classList.add('active');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        
        if (currentAdminPassword) {
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            loadBookings();
        } else {
            document.getElementById('admin-login').style.display = 'block';
            document.getElementById('admin-content').style.display = 'none';
        }
    }
}

// Проверка пароля администратора
async function checkAdmin() {
    let password = prompt("Введите пароль администратора:");
    if (!password) return;
    
    try {
        console.log("🔐 Отправка пароля:", password);
        console.log("📡 URL:", GOOGLE_SCRIPT_URL);
        
        let response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verifyAdmin", password: password })
        });
        
        console.log("📡 Статус ответа:", response.status);
        
        let data = await response.json();
        console.log("📩 Ответ сервера:", data);
        
        if (data.status === "success") {
            currentAdminPassword = password;
            showToast("✅ Вход выполнен!", true);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            loadBookings();
        } else {
            showToast("❌ Неверный пароль!");
        }
    } catch(e) { 
        console.error("❌ Ошибка проверки пароля:", e);
        showToast("❌ Ошибка соединения с сервером");
    }
}

// Загрузка списка броней
async function loadBookings() {
    try {
        let response = await fetch(GOOGLE_SCRIPT_URL);
        let bookings = await response.json();
        
        const tbody = document.getElementById('bookings-body');
        tbody.innerHTML = '';
        
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет броней</td></tr>';
            return;
        }
        
        bookings.forEach(booking => {
            const row = document.createElement('tr');
            
            const statusClass = booking.status === 'Подтверждено' ? 'confirmed' : 
                               booking.status === 'Отменено' ? 'cancelled' : 'awaiting';
            
            row.innerHTML = `
                <td>${booking.id}</td>
                <td>${booking.quest}</td>
                <td>${booking.date}</td>
                <td>${booking.time}</td>
                <td>${booking.name}</td>
                <td>${booking.phone}</td>
                <td>${booking.people}</td>
                <td>
                    <select class="status-select ${statusClass}" onchange="updateStatus('${booking.id}', this.value)">
                        <option value="Ожидает" ${booking.status === 'Ожидает' ? 'selected' : ''}>Ожидает</option>
                        <option value="Подтверждено" ${booking.status === 'Подтверждено' ? 'selected' : ''}>Подтверждено</option>
                        <option value="Отменено" ${booking.status === 'Отменено' ? 'selected' : ''}>Отменено</option>
                    </select>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch(e) {
        console.error('Ошибка загрузки броней:', e);
        showToast('❌ Ошибка загрузки данных');
    }
}

// Обновление статуса брони
async function updateStatus(bookingId, newStatus) {
    try {
        let response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "updateStatus",
                password: currentAdminPassword,
                bookingId: bookingId,
                newStatus: newStatus
            })
        });
        
        let data = await response.json();
        
        if (data.status === "success") {
            showToast("✅ Статус обновлен!", true);
            loadBookings();
        } else {
            showToast("❌ Ошибка: " + data.message);
        }
    } catch(e) {
        console.error('Ошибка обновления статуса:', e);
        showToast('❌ Ошибка соединения');
    }
}

// Отправка формы бронирования
document.getElementById('booking-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        quest: document.getElementById('quest').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        people: document.getElementById('people').value,
        tgUsername: document.getElementById('tg-username').value,
        tgId: "" // Можно добавить получение Telegram ID
    };
    
    // Проверка заполнения
    if (!formData.quest || !formData.date || !formData.time || !formData.name || !formData.phone || !formData.people) {
        showToast('❌ Заполните все обязательные поля!');
        return;
    }
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    
    try {
        let response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        
        let data = await response.json();
        
        if (data.status === "success") {
            showToast('✅ Заявка отправлена! Мы свяжемся с вами.', true);
            this.reset();
        } else {
            showToast('❌ Ошибка: ' + data.message);
        }
    } catch(e) {
        console.error('Ошибка отправки:', e);
        showToast('❌ Ошибка соединения с сервером');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📝 Забронировать';
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение загружено');
    console.log('📡 URL скрипта:', GOOGLE_SCRIPT_URL);
});

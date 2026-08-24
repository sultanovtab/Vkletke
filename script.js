// ============================================
// КОНФИГУРАЦИЯ
// ============================================
// ВАЖНО: Замените на URL вашего деплоя
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbygoXVdarlwZaf7bXb4jZPmZmSAUNVRXLHL6s1lNJeG3mzkGJLNJMNFF9Raw5iXwJ4I/exec";

let currentAdminPassword = "";

// ============================================
// ФУНКЦИЯ ПРОВЕРКИ СОЕДИНЕНИЯ
// ============================================
async function testConnection() {
    console.log("🔍 Тестируем соединение с сервером...");
    console.log("📍 URL:", GOOGLE_SCRIPT_URL);
    
    try {
        // Тест GET запроса
        console.log("📡 Отправляем GET запрос...");
        const getResponse = await fetch(GOOGLE_SCRIPT_URL);
        console.log("✅ GET ответ:", getResponse.status);
        const getData = await getResponse.text();
        console.log("📦 GET данные:", getData);
        
        // Тест POST запроса
        console.log("📡 Отправляем POST запрос...");
        const postResponse = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ test: "connection" })
        });
        console.log("✅ POST ответ:", postResponse.status);
        const postData = await postResponse.text();
        console.log("📦 POST данные:", postData);
        
        return true;
    } catch (error) {
        console.error("❌ Ошибка соединения:", error);
        console.error("❌ Тип ошибки:", error.name);
        console.error("❌ Сообщение:", error.message);
        return false;
    }
}

// ============================================
// ПРОВЕРКА ПАРОЛЯ АДМИНИСТРАТОРА
// ============================================
async function checkAdmin() {
    let password = prompt("Введите пароль администратора:");
    if (!password) return;
    
    console.log("🔐 Начинаем проверку пароля...");
    console.log("📍 URL:", GOOGLE_SCRIPT_URL);
    
    try {
        // Сначала тестируем соединение
        const isConnected = await testConnection();
        if (!isConnected) {
            showToast("❌ Нет соединения с сервером. Проверьте URL.");
            return;
        }
        
        console.log("📡 Отправляем запрос на проверку пароля...");
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                action: "verifyAdmin", 
                password: password 
            })
        });
        
        console.log("📡 Статус ответа:", response.status);
        console.log("📡 Заголовки:", Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("📩 Ответ сервера:", data);
        
        if (data.status === "success") {
            currentAdminPassword = password;
            showToast("✅ Вход выполнен!", true);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            loadBookings();
        } else {
            showToast("❌ " + (data.message || "Неверный пароль"));
        }
    } catch(e) { 
        console.error("❌ Ошибка проверки пароля:", e);
        console.error("❌ Тип ошибки:", e.name);
        console.error("❌ Сообщение:", e.message);
        
        let errorMessage = "Ошибка соединения";
        if (e.message.includes("Failed to fetch")) {
            errorMessage = "Не удалось подключиться к серверу. Проверьте URL и интернет.";
        } else if (e.message.includes("404")) {
            errorMessage = "Сервер не найден (404). Проверьте правильность URL.";
        } else if (e.message.includes("CORS")) {
            errorMessage = "Ошибка CORS. Проверьте настройки деплоя.";
        }
        
        showToast("❌ " + errorMessage);
    }
}

// ============================================
// ЗАГРУЗКА СПИСКА БРОНЕЙ
// ============================================
async function loadBookings() {
    console.log("📋 Загружаем список броней...");
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "getBookings",
                password: currentAdminPassword
            })
        });
        
        console.log("📡 Статус:", response.status);
        
        const bookings = await response.json();
        console.log("📦 Получены брони:", bookings);
        
        const tbody = document.getElementById('bookings-body');
        tbody.innerHTML = '';
        
        if (!Array.isArray(bookings) || bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет броней</td></tr>';
            return;
        }
        
        bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${booking.id || ''}</td>
                <td>${booking.quest || ''}</td>
                <td>${booking.date || ''}</td>
                <td>${booking.time || ''}</td>
                <td>${booking.name || ''}</td>
                <td>${booking.phone || ''}</td>
                <td>${booking.people || ''}</td>
                <td>${booking.status || 'Ожидает'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("❌ Ошибка загрузки:", error);
        showToast("❌ Ошибка загрузки данных");
    }
}

// ============================================
// ОТПРАВКА ФОРМЫ БРОНИРОВАНИЯ
// ============================================
document.getElementById('booking-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    console.log("📝 Отправляем форму бронирования...");
    
    const formData = {
        action: "createBooking",
        quest: document.getElementById('quest').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        people: document.getElementById('people').value,
        tgUsername: document.getElementById('tg-username').value,
        tgId: ""
    };
    
    console.log("📦 Данные формы:", formData);
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        
        console.log("📡 Статус:", response.status);
        
        const data = await response.json();
        console.log("📩 Ответ:", data);
        
        if (data.status === "success") {
            showToast('✅ Заявка отправлена!', true);
            this.reset();
        } else {
            showToast('❌ ' + (data.message || 'Ошибка'));
        }
    } catch(error) {
        console.error("❌ Ошибка:", error);
        showToast('❌ Ошибка соединения');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📝 Забронировать';
    }
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToast(message, isSuccess = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + (isSuccess ? 'success' : 'error');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

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

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение загружено');
    console.log('📍 URL:', GOOGLE_SCRIPT_URL);
    
    // Автоматический тест соединения при загрузке
    setTimeout(async () => {
        await testConnection();
    }, 1000);
});

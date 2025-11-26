// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Основная функция инициализации
function initApp() {
    try {
        // Расширяем приложение на весь экран
        tg.expand();
        
        // Показываем основную кнопку
        tg.MainButton.setText("Обновить");
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
            location.reload();
        });
        
        // Получаем данные пользователя
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Показываем ID пользователя для отладки
        document.getElementById('debugUserId').textContent = user.id || 'Не доступен';
        document.getElementById('debugBackend').textContent = 'Vercel';

        // Отображаем аватар пользователя
        const avatar = document.getElementById('userAvatar');
        if (user.photo_url) {
            avatar.src = user.photo_url;
        } else {
            avatar.src = getDefaultAvatar();
        }

        // Отображаем имя пользователя
        const userName = document.getElementById('userName');
        userName.textContent = user.first_name || 'Пользователь';

        // Отображаем фамилию
        const userLastName = document.getElementById('userLastName');
        userLastName.textContent = user.last_name || 'Не указана';

        // Отображаем описание (bio) с проверкой доступности
        const userBio = document.getElementById('userBio');
        if (user.bio && user.bio.trim() !== '') {
            userBio.textContent = user.bio;
        } else {
            userBio.textContent = 'Био не доступно или не заполнено';
            userBio.style.color = '#6c757d';
            userBio.style.fontStyle = 'italic';
        }

        // Проверяем подписку на канал
        checkRealSubscription(user.id);

        // Показываем все данные для отладки
        console.log('📱 Данные пользователя:', user);
        console.log('🔧 Все initData:', tg.initDataUnsafe);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        document.body.innerHTML = '<div class="loading">Ошибка загрузки приложения</div>';
    }
}

// Реальная проверка подписки через Vercel бэкенд
async function checkRealSubscription(userId) {
    const statusElement = document.getElementById('subscriptionStatus');
    
    try {
        statusElement.innerHTML = '🔍 Проверяем подписку...';
        statusElement.className = 'subscription-status';

        // Ваш URL бэкенда на Vercel
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-subscription';
        
        console.log('📤 Отправляем запрос к:', backendUrl);
        console.log('👤 User ID:', userId);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId
            })
        });

        const result = await response.json();
        
        console.log('📥 Ответ от бэкенда:', result);

        if (result.success && result.isSubscribed) {
            statusElement.innerHTML = `
                ✅ Вы подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                <br><small>Статус: ${result.status}</small>
            `;
            statusElement.className = 'subscription-status subscribed';
        } else {
            statusElement.innerHTML = `
                ❌ Вы не подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                ${result.error ? `<br><small>Ошибка: ${result.error}</small>` : ''}
                <br><br>
                <button onclick="subscribeToChannel()" class="subscribe-btn">Подписаться на канал</button>
                <br><br>
                <small>После подписки нажмите "Обновить"</small>
            `;
            statusElement.className = 'subscription-status not-subscribed';
        }

    } catch (error) {
        console.error('❌ Ошибка проверки подписки:', error);
        statusElement.innerHTML = `
            ⚠️ Не удалось проверить подписку
            <br><small>Ошибка сети: ${error.message}</small>
            <br><br>
            <button onclick="checkRealSubscription(${userId})" class="subscribe-btn">Попробовать снова</button>
            <br><br>
            <button onclick="useSimpleCheck()" class="subscribe-btn">Использовать простую проверку</button>
        `;
        statusElement.className = 'subscription-status not-subscribed';
    }
}

// Простая проверка подписки (запасной вариант)
function useSimpleCheck() {
    const statusElement = document.getElementById('subscriptionStatus');
    
    statusElement.innerHTML = `
        📋 Простая проверка подписки:
        <br><br>
        1. Подпишитесь на <a href="https://t.me/CS2DropZone" class="channel-link">@CS2DropZone</a>
        <br>
        2. Нажмите кнопку ниже после подписки
        <br><br>
        <button onclick="subscribeToChannel()" class="subscribe-btn">📲 Перейти в канал</button>
        <br><br>
        <button onclick="confirmSubscription()" class="subscribe-btn">✅ Я подписался</button>
    `;
    statusElement.className = 'subscription-status not-subscribed';
}

// Функция для перехода к каналу
function subscribeToChannel() {
    tg.openLink('https://t.me/CS2DropZone');
}

// Подтверждение подписки (для простой проверки)
function confirmSubscription() {
    const statusElement = document.getElementById('subscriptionStatus');
    statusElement.innerHTML = '🎉 Спасибо за подписку! Доступ открыт!';
    statusElement.className = 'subscription-status subscribed';
    
    // Сохраняем в localStorage
    localStorage.setItem('subscribedToCS2DropZone', 'true');
}

// Функция для создания заглушки аватара
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);

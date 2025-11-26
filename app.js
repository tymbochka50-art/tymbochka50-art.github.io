// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Основная функция инициализации
function initApp() {
    try {
        // Расширяем приложение на весь экран
        tg.expand();
        
        // Получаем данные пользователя
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Отображаем аватар пользователя
        const avatar = document.getElementById('userAvatar');
        if (user.photo_url) {
            avatar.src = user.photo_url;
        } else {
            // Заглушка если аватар отсутствует
            avatar.src = getDefaultAvatar();
        }

        // Отображаем имя пользователя
        const userName = document.getElementById('userName');
        userName.textContent = user.first_name || 'Пользователь';

        // Отображаем фамилию
        const userLastName = document.getElementById('userLastName');
        userLastName.textContent = user.last_name || 'Не указана';

        // Отображаем описание (bio)
        const userBio = document.getElementById('userBio');
        userBio.textContent = user.bio || 'Не указано';

        // Проверяем подписку на канал
        checkSubscription();

    } catch (error) {
        console.error('Ошибка инициализации:', error);
        document.body.innerHTML = '<div class="loading">Ошибка загрузки приложения</div>';
    }
}

// Функция для создания заглушки аватара
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Функция для проверки подписки на канал
function checkSubscription() {
    const statusElement = document.getElementById('subscriptionStatus');
    
    // В реальном приложении здесь должен быть вызов к вашему бэкенду
    // Для демонстрации используем случайный результат
    
    const isSubscribed = Math.random() > 0.5;
    
    if (isSubscribed) {
        statusElement.innerHTML = `
            ✅ Вы подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
        `;
        statusElement.className = 'subscription-status subscribed';
    } else {
        statusElement.innerHTML = `
            ❌ Вы не подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
            <br><br>
            <button onclick="subscribeToChannel()" class="subscribe-btn">Подписаться на канал</button>
        `;
        statusElement.className = 'subscription-status not-subscribed';
    }
}

// Функция для перехода к каналу
function subscribeToChannel() {
    tg.openLink('https://t.me/CS2DropZone');
}

// Функция для показа всех данных (для отладки)
function showAllData() {
    console.log('Все данные от Telegram:', tg.initDataUnsafe);
    console.log('Пользователь:', tg.initDataUnsafe?.user);
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    // Показываем все данные в консоли для отладки
    showAllData();
});
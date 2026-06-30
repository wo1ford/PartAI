
Ты — опытный Frontend-разработчик, специализирующийся на Vue 3, TypeScript, PrimeVue и интеграции с zebrainsknowlenge.

Твоя задача — создать frontend-интерфейс для работы с базой данных.

ОСНОВНОЕ ПРАВИЛО:
Все архитектурные решения, структуру папок, правила именования файлов, способ организации модулей, компонентов, stores, services, composables и API-слоёв нужно брать из zebrainsknowlenge.

Не придумывай собственную структуру проекта.
Не предлагай свою структуру папок.
Не используй заранее заданную структуру, если она не получена из zebrainsknowlenge.

Перед началом генерации проекта обязательно запроси или используй знания из zebrainsknowlenge по следующим темам:
- структура frontend-проекта;
- правила расположения файлов и папок;
- правила именования компонентов;
- правила именования stores;
- правила именования composables;
- правила именования API-сервисов;
- правила разделения features, pages, shared, entities или других слоёв, если они используются;
- правила подключения PrimeVue;
- правила работы с backend API;
- правила валидации;
- правила обработки ошибок;
- правила UI/UX для проекта.

Стек проекта:
- Vue 3
- TypeScript
- Composition API
- Vite
- Pinia
- Vue Router
- PrimeVue
- PrimeIcons
- Axios
- REST API
- zebrainsknowlenge

ВАЖНО ПО UI:
Все UI-компоненты должны быть только из PrimeVue.

Запрещено использовать:
- самописные Button;
- самописные Input;
- самописные Modal/Dialog;
- самописные Select;
- самописные Table;
- Tailwind UI;
- Headless UI;
- Bootstrap;
- Vuetify;
- Element Plus;
- Ant Design Vue;
- любые UI-библиотеки кроме PrimeVue.

Разрешено использовать обычные HTML-контейнеры только для layout, если это необходимо.

Используй PrimeVue-компоненты:
- DataTable
- Column
- Button
- InputText
- Select или Dropdown
- Dialog
- ConfirmDialog
- Toast
- Toolbar
- Card
- Panel
- Tag
- DatePicker или Calendar
- Paginator
- ProgressSpinner
- Skeleton
- Message
- Tooltip
- IconField
- InputIcon
- Divider
- Badge
- Menu
- Menubar

Главное требование по zebrainsknowlenge:
Frontend должен сверяться с zebrainsknowlenge при каждом запросе и при каждом важном действии пользователя.

Обязательные проверки через zebrainsknowlenge:
1. Перед загрузкой списка записей.
2. Перед открытием формы создания.
3. Перед созданием записи.
4. Перед открытием формы редактирования.
5. Перед сохранением изменений.
6. Перед удалением записи.
7. Перед применением фильтров.
8. Перед сортировкой, если правила сортировки описаны в zebrainsknowlenge.
9. После ошибки backend.
10. При изменении бизнес-значимых полей формы.

Если zebrainsknowlenge недоступен:
- создание должно быть заблокировано;
- редактирование должно быть заблокировано;
- удаление должно быть заблокировано;
- пользователь должен увидеть ошибку через PrimeVue Message или Toast;
- чтение данных можно разрешить только с предупреждением, если это допускается правилами zebrainsknowlenge.

Пример сущности данных:

{
  id: number,
  name: string,
  email: string,
  status: "active" | "inactive",
  createdAt: string
}

Функциональные требования:
1. Страница со списком записей.
2. Таблица через PrimeVue DataTable.
3. Колонки через PrimeVue Column.
4. Поиск по разрешённым полям.
5. Фильтрация только по полям, разрешённым zebrainsknowlenge.
6. Сортировка только по полям, разрешённым zebrainsknowlenge.
7. Пагинация.
8. Создание записи через PrimeVue Dialog.
9. Редактирование записи через PrimeVue Dialog.
10. Удаление через PrimeVue ConfirmDialog.
11. Toast-уведомления.
12. Loading-state для backend API.
13. Отдельный loading-state для zebrainsknowlenge.
14. Error-state.
15. Empty-state.
16. Отображение статусов через PrimeVue Tag.
17. Подсказки к полям из zebrainsknowlenge.
18. Labels, placeholders и descriptions брать из zebrainsknowlenge.
19. Валидацию формы строить на основе правил из zebrainsknowlenge.
20. Ошибки backend объяснять через zebrainsknowlenge.

Backend REST API:
Используй endpoints:

GET /records
GET /records/:id
POST /records
PUT /records/:id
DELETE /records/:id

zebrainsknowlenge API:
Используй endpoints или правила, описанные в zebrainsknowlenge.  
Если точные endpoints не известны, создай отдельный knowledge service и заложи в него типизированные методы:

- получение структуры проекта;
- получение правил архитектуры;
- получение описания сущности;
- получение описания полей;
- получение правил валидации;
- получение разрешённых фильтров;
- получение разрешённых сортировок;
- проверка действия;
- валидация данных;
- объяснение ошибок backend.

Обязательный принцип:
Любой backend-запрос должен проходить через knowledge guard.

Сценарий чтения данных:
1. Получить актуальные знания из zebrainsknowlenge.
2. Проверить разрешённые фильтры, сортировки и параметры запроса.
3. Выполнить backend-запрос.
4. Если backend вернул ошибку, отправить её в zebrainsknowlenge для объяснения.
5. Показать пользователю понятное сообщение.

Сценарий создания:
1. Получить актуальные правила из zebrainsknowlenge.
2. Проверить форму по правилам zebrainsknowlenge.
3. Отправить данные на валидацию через zebrainsknowlenge.
4. Только после успешной проверки выполнить POST-запрос.
5. После ошибки backend запросить объяснение ошибки через zebrainsknowlenge.

Сценарий редактирования:
1. Получить актуальные правила из zebrainsknowlenge.
2. Проверить изменённые данные.
3. Отправить данные на валидацию через zebrainsknowlenge.
4. Только после успешной проверки выполнить PUT-запрос.
5. После ошибки backend запросить объяснение ошибки через zebrainsknowlenge.

Сценарий удаления:
1. Проверить действие удаления через zebrainsknowlenge.
2. Если удаление разрешено, показать PrimeVue ConfirmDialog.
3. После подтверждения выполнить DELETE-запрос.
4. Если удаление запрещено, показать объяснение пользователю.

Технические требования:
1. Используй Vue 3 Composition API.
2. Используй `<script setup lang="ts">`.
3. Весь код должен быть на TypeScript.
4. Используй Pinia.
5. Используй Vue Router.
6. Используй Axios.
7. Все API-запросы должны быть типизированы.
8. Не используй Options API.
9. Не используй самописные UI-компоненты вместо PrimeVue.
10. Не хардкодь структуру папок — бери её из zebrainsknowlenge.
11. Не хардкодь бизнес-правила — бери их из zebrainsknowlenge.
12. Не хардкодь labels, placeholders, descriptions — бери их из zebrainsknowlenge.
13. Код должен быть полноценным, не псевдокодом.

Что нужно выдать:
1. Команды создания проекта через Vite.
2. Команды установки зависимостей.
3. Объяснение, что структура папок берётся из zebrainsknowlenge.
4. Код подключения PrimeVue.
5. Код main.ts.
6. Код App.vue.
7. Код Vue Router.
8. Код Pinia stores согласно правилам zebrainsknowlenge.
9. Код API-клиента.
10. Код backend API service.
11. Код zebrainsknowlenge service.
12. Код knowledge guard.
13. TypeScript-типы.
14. Код страницы со списком записей.
15. Код таблицы на PrimeVue DataTable.
16. Код формы на PrimeVue Dialog и PrimeVue form-компонентах.
17. Код фильтров на PrimeVue.
18. Код удаления через PrimeVue ConfirmDialog.
19. Код Toast-уведомлений.
20. Код обработки ошибок через zebrainsknowlenge.
21. Пример .env.
22. Инструкцию запуска проекта.
23. Объяснение, как подключить frontend к backend и zebrainsknowlenge.

Перед выводом кода:
Сначала опиши, какие правила архитектуры, структуры папок и именования были получены из zebrainsknowlenge.

Если zebrainsknowlenge не предоставил правила структуры:
- не придумывай их молча;
- явно напиши, что правила структуры не найдены;
- предложи минимальную временную структуру только как fallback;
- пометь её как временную и требующую подтверждения в zebrainsknowlenge.

Сгенерируй полноценную реализацию проекта.
Не сокращай код.
Не используй псевдокод.
Не заменяй PrimeVue самописными компонентами.
```

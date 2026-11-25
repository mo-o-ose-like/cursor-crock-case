import {stages} from './sample-network.js';

// The organisation, people, assessments, and agreements are fictional.
const [discovery, negotiation, technical, budget, approval] = stages;
const [economic, expert, user, coach] = [
  'Экономический покупатель', 'Технический эксперт', 'Пользователь', 'Наставник'
];
const [board, finance, it, business, security, procurement, legal, regions] = [
  'Дирекция', 'Финансовый департамент', 'ИТ-департамент', 'Бизнес-подразделение',
  'Служба ИБ', 'Отдел закупок', 'Юридический департамент', 'Филиальная сеть'
];
const [crm, workshops, pilot, budgetCommittee] = [
  'Демо CRM', 'Демо-протоколы встреч', 'Демо-отчёт пилота', 'Демо-протокол бюджетного комитета'
];

export const defenseDeal = {
  id: 'predzashchita',
  title: 'Предзащита · Единое рабочее пространство',
  company: 'ООО Балтийские Системы',
  participant: 'Ольга Соколова',
  position: 'Директор по операционной эффективности',
  role: coach,
  tags: ['Предзащита', 'Интранет', '24 филиала'],
  agreement: 'Проверить экономику развёртывания на 24 филиала',
  notes: 'Пилот в двух филиалах завершён. Бюджет зависит от заключения ИБ.',
  stage: budget
};

const settings = {
  product: 'Корпоративный портал и единое рабочее пространство для 2 400 сотрудников в 24 филиалах. В предложении есть интеграция с кадровой системой, единый вход, база знаний и защищённый доступ с личных телефонов.',
  stage: budget,
  budget: '48000000',
  goal: 'Преодолеть возражения',
  plan: 'До 04.12 закрыть замечания ИБ на пилоте. До 08.12 сверить финансовую модель с Павлом Никифоровым. Через Ольгу Соколову подтвердить резервный контакт с Лидией Филатовой и вынести вопрос на комитет 11.12.',
  constraints: 'На 48 млн ₽ требуется виза финансового директора и решение комитета. Доступ с личных телефонов требует заключения ИБ. После 18.12 перенос витрин ограничен годовой инвентаризацией.'
};

const agreement = (title, date, status, detail) => ({title, date, status, detail});

function person(id, name, title, dept, stage, role, task, details = {}) {
  return {
    id, name, title, dept, stage, role, task,
    level: 'Специалист',
    formal: task,
    state: 'active',
    attitude: 'Нейтрально',
    contact: 'Контакт установлен',
    roleStatus: role ? 'confirmed' : 'assumed',
    decision: false,
    primary: false,
    influence: 'Среднее',
    risks: [],
    opinions: [],
    disc: null,
    goals: [],
    preferences: [],
    goalHint: '',
    preferenceHint: '',
    agreements: [],
    source: crm,
    ...details
  };
}

export function defenseRecord(deal) {
  const people = [
    person('general', 'Глеб Семёнов', 'Генеральный директор', board, approval, economic, 'Утверждает тиражирование по итогам бюджетного комитета.', {
      level: 'Руководство', state: 'planned', attitude: 'Неизвестно', contact: 'Контакт планируется', influence: 'Высокое',
      agreements: [agreement('Решение бюджетного комитета', '2026-12-11', 'Запланировано', 'Рассмотреть экономику тиражирования и условия защиты данных.')]
    }),
    person('finance', 'Аркадий Титов', 'Финансовый директор', finance, budget, economic, 'Проверяет окупаемость и визирует лимит 48 млн ₽.', {
      level: 'Руководство', decision: true, attitude: 'Сомневается', influence: 'Высокое', source: budgetCommittee,
      risks: ['Комитет может перенести решение без двух вариантов бюджета.'],
      goals: ['Подтвердить срок окупаемости не более 24 месяцев.'],
      preferences: ['На комитет нужен один лист с базовым и поэтапным вариантами.'],
      agreements: [agreement('Финансовая модель', '2026-12-08', 'Запланировано', 'Сравнить тиражирование на 24 филиала с запуском двумя очередями.')]
    }),
    person('business', 'Ольга Соколова', 'Директор по операционной эффективности', business, budget, coach, 'Курирует пилот и связывает КРОК с владельцами процесса.', {
      level: 'Руководство', primary: true, attitude: 'Поддерживает', influence: 'Высокое', source: workshops,
      formal: 'Отвечает за эффективность общих процессов, цифровые инициативы и программу изменений в филиалах.',
      risks: ['Через Ольгу идёт согласование повестки комитета. Резервный канал ещё не подтверждён.'],
      disc: {D: 70, I: 81, S: 57, C: 44},
      opinions: [
        {label: 'Доводит договорённости до результата', authors: ['Лидия Филатова', 'Софья Шилова', 'Роман Яровой', 'Дарья Котова']},
        {label: 'Открыта к пилотам', authors: ['Лидия Филатова', 'Дарья Котова', 'Инна Волкова']},
        {label: 'Требовательна к срокам', authors: ['Аркадий Титов', 'Софья Шилова']}
      ],
      goals: ['Сократить среднее время поиска инструкций с 8 до 3 минут.', 'Довести недельную активность пользователей пилота до 75%.'],
      preferences: ['Показывать метрики по филиалам на одном экране.', 'Присылать материалы к встрече за день.'],
      goalHint: 'Возможно, для согласования ей важен отдельный показатель для сотрудников без стационарного ПК.',
      preferenceHint: 'Перед комитетом отправить краткое сравнение полного запуска и тиражирования по очередям.',
      agreements: [
        agreement('Отчёт пилота в двух филиалах', '2026-11-24', 'Согласовано', 'Целевое время поиска достигнуто. Замеры использования личных телефонов ещё проверяет ИБ.'),
        agreement('Повестка бюджетного комитета', '2026-12-09', 'Запланировано', 'Свести заключение ИБ, финансовую модель и план тиражирования.'),
        agreement('Резервный канал через Лидию Филатову', '', 'Ожидает подтверждения', 'Уточнить, сможет ли ИТ-директор вести подготовку комитета в отсутствие Ольги.')
      ]
    }),
    person('technical', 'Лидия Филатова', 'Директор по ИТ', it, technical, expert, 'Принимает архитектуру и ведёт технический контур пилота.', {
      level: 'Руководство', attitude: 'Поддерживает', influence: 'Высокое', source: workshops,
      goals: ['Сохранить единый вход и централизованные права доступа.'],
      agreements: [agreement('Приёмка интеграций', '2026-11-25', 'Согласовано', 'Единый вход и синхронизация сотрудников проверены на тестовом контуре.')]
    }),
    person('security', 'Анна Алексеева', 'Директор по информационной безопасности', security, technical, expert, 'Выдаёт заключение по доступу с личных телефонов.', {
      level: 'Руководство', attitude: 'Возражает', influence: 'Высокое', source: workshops,
      risks: ['Без отзыва доступа при потере телефона ИБ не выдаст заключение.'],
      goals: ['Подтвердить отзыв доступа к корпоративным данным за 15 минут.'],
      preferences: ['Нужны воспроизводимые тесты и журнал событий.'],
      agreements: [agreement('Повторный тест отзыва доступа', '2026-12-04', 'Запланировано', 'Показать отзыв сессии и проверить запись о событии в журнале.')]
    }),
    person('procurement', 'Софья Шилова', 'Руководитель закупок', procurement, discovery, coach, 'Разъяснила порядок закупки и передала перечень документов.', {
      level: 'Руководитель подразделения', state: 'finished', source: workshops,
      agreements: [agreement('Контрольный список закупки', '2026-11-10', 'Согласовано', 'Выданы шаблоны спецификации, ценового сравнения и договора.')]
    }),
    person('legal', 'Виктория Орехова', 'Директор по правовым вопросам', legal, approval, expert, 'Визирует договор после заключения ИБ.', {
      level: 'Руководство', state: 'planned', contact: 'Контакт планируется', attitude: 'Неизвестно', influence: 'Высокое',
      agreements: [agreement('Юридическая виза', '2026-12-15', 'Запланировано', 'Проверить условия обработки данных, SLA и критерии приёмки.')]
    }),
    person('region', 'Роман Яровой', 'Директор филиальной сети', regions, negotiation, user, 'Подтверждает готовность регионов к тиражированию.', {
      level: 'Руководство', attitude: 'Поддерживает',
      goals: ['Запускать новые филиалы без остановки смен.']
    }),
    person('budget', 'Павел Никифоров', 'Руководитель бюджетирования', finance, budget, expert, 'Сводит капитальные и операционные затраты по двум вариантам.', {
      level: 'Руководитель подразделения', source: budgetCommittee,
      agreements: [agreement('Сверка стоимости владения', '2026-12-07', 'Запланировано', 'Учесть поддержку, обучение сотрудников и стоимость интеграций.')]
    }),
    person('controller', 'Елена Рубцова', 'Финансовый контролёр', finance, budget, expert, 'Проверяет, из каких подразделений финансируется запуск.', {
      state: 'planned', contact: 'Контакт планируется', attitude: 'Неизвестно', roleStatus: 'assumed',
      risks: ['Доли затрат филиалов пока не подтверждены.']
    }),
    person('architect', 'Максим Белов', 'Главный архитектор', it, technical, expert, 'Сверяет единый вход, права и кадровую интеграцию.', {
      attitude: 'Поддерживает', source: pilot
    }),
    person('operations', 'Пётр Долгов', 'Руководитель эксплуатации', it, technical, expert, 'Согласует мониторинг, SLA и порядок отката.', {
      level: 'Руководитель подразделения', attitude: 'Сомневается',
      agreements: [agreement('Окно переключения', '', 'Ожидает подтверждения', 'Согласовать время с филиалами и подтвердить план отката.')]
    }),
    person('integration', 'Яна Вересова', 'Инженер интеграций', it, technical, expert, 'Проверила синхронизацию кадровых данных и деактивацию учётных записей.', {
      state: 'finished', attitude: 'Поддерживает', source: pilot
    }),
    person('product', 'Дарья Котова', 'Владелец корпоративного портала', business, negotiation, user, 'Принимает базу знаний, ленту новостей и поиск.', {
      attitude: 'Поддерживает', source: pilot,
      goals: ['Сократить число обращений в поддержку по поиску регламентов.'],
      agreements: [agreement('Приёмка поиска', '2026-11-23', 'Согласовано', 'Приняты 18 из 20 контрольных запросов. Для двух запросов обновить синонимы.')]
    }),
    person('training', 'Лев Давыдов', 'Руководитель обучения', business, negotiation, user, 'Готовит обучение администраторов и материалы для филиалов.', {
      level: 'Руководитель подразделения', state: 'planned', contact: 'Контакт планируется', attitude: 'Неизвестно'
    }),
    person('support', 'Инна Волкова', 'Руководитель поддержки пользователей', business, discovery, user, 'Собрала типовые обращения и передала требования к базе знаний.', {
      level: 'Руководитель подразделения', state: 'finished', attitude: 'Поддерживает', source: pilot
    }),
    person('security-architect', 'Вадим Шестаков', 'Архитектор ИБ', security, technical, expert, 'Проводит проверку журналов и сценария потери телефона.', {
      attitude: 'Сомневается', source: pilot
    }),
    person('privacy', 'Майя Осипова', 'Специалист по защите персональных данных', security, technical, '', 'Уточняет, какие персональные данные остаются на устройстве.', {
      contact: 'Нет данных', attitude: 'Неизвестно', influence: 'Неизвестно'
    }),
    person('category', 'Константин Лебедев', 'Категорийный менеджер ИТ', procurement, negotiation, coach, 'Принимает спецификацию и сравнивает состав предложений.', {
      attitude: 'Поддерживает'
    }),
    person('tender', 'Наталья Ким', 'Координатор тендера', procurement, approval, coach, 'Собирает пакет документов для публикации процедуры.', {
      state: 'planned', contact: 'Контакт планируется', attitude: 'Неизвестно', roleStatus: 'assumed'
    }),
    person('counsel', 'Игорь Мартынов', 'Юрист по ИТ-договорам', legal, approval, expert, 'Проверяет лицензионные условия и приложение об обработке данных.', {
      state: 'planned', contact: 'Нет контакта', attitude: 'Неизвестно'
    }),
    person('branch-east', 'Марина Власова', 'Директор Восточного филиала', regions, technical, user, 'Проверила пилот на рабочих местах без стационарных компьютеров.', {
      level: 'Руководитель подразделения', state: 'finished', attitude: 'Поддерживает', source: pilot
    }),
    person('branch-west', 'Денис Савин', 'Директор Западного филиала', regions, negotiation, user, 'Оценивает готовность филиала к переходу в сезон высокой нагрузки.', {
      level: 'Руководитель подразделения', attitude: 'Против',
      risks: ['Окно запуска пересекается с годовой инвентаризацией.']
    }),
    person('field', 'Тамара Лукина', 'Координатор выездных сотрудников', regions, '', '', 'Собирает обратную связь выездных бригад по мобильной версии.', {
      state: 'planned', contact: 'Нет данных', attitude: 'Неизвестно', influence: 'Неизвестно'
    }),
    person('committee', 'Алексей Карпов', 'Секретарь бюджетного комитета', board, approval, coach, 'Формирует повестку и контролирует комплектность пакета.', {
      state: 'planned', contact: 'Контакт планируется', attitude: 'Неизвестно'
    })
  ];

  const org = [
    ['general', 'finance'], ['general', 'technical'], ['general', 'business'],
    ['general', 'security'], ['general', 'procurement'], ['general', 'legal'], ['general', 'region'],
    ['general', 'committee'], ['finance', 'budget'], ['budget', 'controller'],
    ['technical', 'architect'], ['technical', 'operations'], ['architect', 'integration'],
    ['business', 'product'], ['business', 'training'], ['business', 'support'],
    ['security', 'security-architect'], ['security', 'privacy'],
    ['procurement', 'category'], ['procurement', 'tender'], ['legal', 'counsel'],
    ['region', 'branch-east'], ['region', 'branch-west'], ['branch-west', 'field']
  ].map(([a, b]) => ({a, b, kind: 'org', status: 'formal', strength: 'strong', source: crm}));

  const process = [
    ['procurement', 'business', 'done', '2026-11-10', 'Софья представила владельца инициативы и объяснила порядок закупки.'],
    ['support', 'product', 'done', '2026-11-12', 'Типовые обращения поддержки стали контрольными запросами для поиска.'],
    ['branch-east', 'product', 'done', '2026-11-23', 'Филиал передал результаты полевого пилота.'],
    ['integration', 'architect', 'done', '2026-11-24', 'Инженер передала протокол тестирования кадровой интеграции.'],
    ['business', 'technical', 'established', '2026-11-18', 'Ольга и Лидия ведут еженедельную встречу по итогам пилота.'],
    ['business', 'region', 'established', '2026-11-19', 'Ольга подключила руководителя филиальной сети к плану тиражирования.'],
    ['region', 'branch-west', 'established', '2026-11-24', 'Западный филиал запросил сдвиг запуска после инвентаризации.'],
    ['technical', 'architect', 'established', '2026-11-18', 'Лидия поручила закрыть замечания по единому входу.'],
    ['technical', 'security', 'established', '2026-11-25', 'Лидия передала Анне требования к мобильному доступу.'],
    ['architect', 'operations', 'established', '2026-11-25', 'Архитектор передал в эксплуатацию план мониторинга.'],
    ['security', 'security-architect', 'established', '2026-11-25', 'Анна поручила проверить журналирование отзыва сессии.'],
    ['security-architect', 'privacy', 'planned', '2026-12-03', 'Пригласить Майю на проверку состава данных на устройстве.'],
    ['business', 'training', 'planned', '2026-12-03', 'Согласовать владельца обучения и календарь двух очередей.'],
    ['business', 'budget', 'established', '2026-11-25', 'Ольга передала эффект пилота для финансовой модели.'],
    ['budget', 'controller', 'planned', '2026-12-07', 'Подтвердить распределение затрат между филиалами.'],
    ['budget', 'finance', 'planned', '2026-12-08', 'Показать Аркадию два варианта расходов и срок окупаемости.'],
    ['finance', 'committee', 'planned', '2026-12-09', 'Передать пакет на комитет при наличии заключения ИБ.'],
    ['committee', 'general', 'planned', '2026-12-11', 'Вынести решение о тираже на бюджетный комитет.'],
    ['category', 'tender', 'planned', '2026-12-14', 'Передать утверждённую спецификацию и итоговое сравнение цен.'],
    ['legal', 'counsel', 'planned', '2026-12-15', 'Проверить SLA и условия обработки персональных данных.']
  ].map(([a, b, status, date, text]) => ({
    a, b, kind: 'process', status, date, text, source: workshops,
    strength: {done: 'limited', established: 'strong', planned: 'assumed'}[status]
  }));

  const influence = [
    ['finance', 'general', 'strong', budgetCommittee, 'Глеб рассматривает тиражирование после визы Аркадия по лимиту.'],
    ['business', 'finance', 'strong', budgetCommittee, 'Аркадий запросил расчёт эффекта на основе пилота Ольги.'],
    ['security', 'technical', 'strong', workshops, 'Без визы Анны Лидия не принимает мобильный доступ.'],
    ['technical', 'finance', 'strong', workshops, 'Лидия защищает бюджет интеграций и эксплуатации перед Аркадием.'],
    ['budget', 'finance', 'strong', budgetCommittee, 'Аркадий использует сверенную Павлом модель как основание для визы.'],
    ['legal', 'general', 'limited', workshops, 'Виктория может поставить условие согласования на исполнение договора.'],
    ['region', 'business', 'limited', workshops, 'Роман определяет порядок подключения филиалов.'],
    ['product', 'business', 'limited', pilot, 'Ольга опирается на метрики принятия портала у Дарьи.'],
    ['architect', 'technical', 'limited', pilot, 'Лидия опирается на заключение Максима об интеграциях.'],
    ['operations', 'technical', 'limited', workshops, 'Пётр согласует порядок переключения с Лидией.'],
    ['security-architect', 'security', 'limited', pilot, 'Решение Анны опирается на результаты теста Вадима.'],
    ['branch-west', 'region', 'limited', workshops, 'Денис подтвердил, что окно Западного филиала зависит от инвентаризации.'],
    ['privacy', 'legal', 'assumed', workshops, 'Гипотеза: замечания Майи могут изменить требования к договору.'],
    ['controller', 'budget', 'assumed', budgetCommittee, 'Гипотеза: Елена может предложить перераспределение затрат.'],
    ['field', 'branch-west', 'assumed', pilot, 'Гипотеза: отчёт выездных бригад повлияет на согласие Дениса на вторую очередь.'],
    ['category', 'procurement', 'limited', workshops, 'Софья использует сравнение комплектов, подготовленное Константином.']
  ].map(([a, b, status, source, text]) => ({
    a, b, kind: 'influence', status, strength: status, source, text,
    date: status === 'assumed' ? '' : '2026-11-25'
  }));

  return {
    deal: {...deal, tags: [...deal.tags]},
    settings: {...settings},
    people,
    edges: [...org, ...process, ...influence],
    sources: [crm, workshops, pilot, budgetCommittee]
  };
}

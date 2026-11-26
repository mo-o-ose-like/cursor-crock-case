import {relationData} from './relations.js';

const missingValues = new Set(['', 'нет данных', 'неизвестно', 'не указано', 'не определено', 'уточнить', '—']);
export const missingValue = value => missingValues.has(String(value ?? '').trim().toLocaleLowerCase('ru'));

const profileFields = [
  ['title', 'role', 'Какая должность у сотрудника?'],
  ['task', 'role', 'За что отвечает в закупке?'],
  ['stage', 'role', 'На каком этапе закупки участвует?'],
  ['role', 'role', 'Какова роль по Miller–Heiman?'],
  ['attitude', 'relations', 'Как относится к сделке?'],
  ['contact', 'relations', 'Установлен ли контакт с КРОК?']
];

export function knowledgeGaps(record) {
  const people = record.people.filter(p => !p.modes || p.modes.includes('process'));
  const scheduled = new Set();
  for (const edge of record.edges || []) {
    if (edge.kind !== 'process') continue;
    const transition = relationData(edge, 'process', record.people);
    if (transition.status === 'planned' && !missingValue(transition.date)) scheduled.add(edge.b);
  }
  const entries = [];
  for (const person of people) {
    const target = {personId:person.id, name:person.name};
    for (const [field, section, question] of profileFields) {
      if (missingValue(person[field])) entries.push({...target, field, section, question});
    }
    if (person.state === 'planned' && person.contact !== 'Контакт установлен' &&
        missingValue(person.firstContactDate) && !scheduled.has(person.id)) {
      entries.push({...target, field:'firstContactDate', section:'relations', question:'Когда запланирован первый контакт?'});
    }
    for (const [index, agreement] of (person.agreements || []).entries()) {
      if (missingValue(agreement.date)) entries.push({...target, section:'agreements', index,
        question:'На какую дату назначена договорённость «' + (agreement.title || 'Без названия') + '»?'});
    }
  }
  const deal = [];
  if (missingValue(record.settings?.budget)) deal.push({field:'budget', question:'Какой бюджет утверждён для сделки?'});
  if (!record.people.some(p => p.decision)) deal.push({field:'decision', question:'Кто принимает окончательное решение?'});
  if (!record.people.some(p => p.primary)) deal.push({field:'primary', question:'Кто основной контакт КРОК?'});
  return {entries, deal};
}

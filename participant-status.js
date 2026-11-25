import {esc} from './components.js';

const tones = new Map([
  ['Поддерживает', 'support'], ['Активно поддерживает', 'support'],
  ['Нейтрально', 'neutral'], ['Сомневается', 'doubt'],
  ['Против', 'opposed'], ['Возражает', 'opposed'], ['Блокирует', 'opposed']
]);

export function attitudeTone(value) {
  return tones.get(value) || 'unknown';
}
export function statusBadge(value, kind) {
  const tone = kind === 'contact' ? 'contact' : attitudeTone(value);
  return '<span class="chip status-' + tone + '">' + esc(value || 'Неизвестно') + '</span>';
}

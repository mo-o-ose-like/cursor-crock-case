const roles = [
  ['E','Economic Buyer','Экономический покупатель'],
  ['T','Technical Buyer','Технический согласующий','Технический эксперт'],
  ['U','User Buyer','Представитель пользователей','Пользователь'],
  ['C','Coach','Наставник']
];
const lookup = new Map();
for (const [code, english, russian, ...aliases] of roles) {
  const role = {code, name:english+' · '+russian};
  for (const alias of [code, english, russian, role.name, ...aliases]) {
    lookup.set(alias.toLocaleLowerCase('ru'), role);
  }
}
const resolve = value => lookup.get(String(value ?? '').trim().toLocaleLowerCase('ru'));
export const labelRole = value => resolve(value)?.code || '—';
export const roleName = participant => resolve(participant.role)?.name || participant.role || 'Роль не определена';

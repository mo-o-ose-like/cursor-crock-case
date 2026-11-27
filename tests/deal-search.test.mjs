import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findParticipants} from '../deal-search.js';

const records=[
  {deal:{id:'a',title:'Сервис-деск',company:'Северный Вектор'},people:[
    {id:'technical',name:'Елена Фёдорова',title:'Руководитель эксплуатации',dept:'ИТ-департамент'},
    {id:'buyer',name:'Ирина Крылова',title:'Финансовый директор',dept:'Финансы',decision:true}
  ]},
  {deal:{id:'b',title:'Сеть филиалов',company:'ПромАльянс'},people:[
    {id:'technical',name:'Елена Фёдорова',title:'Директор',dept:'Инфраструктура'},
    {id:'what-if-new',name:'Елена Предложенная',ai:true}
  ]}
];
test('searches all deal participants by partial name, title, department and buyer role',()=>{
  assert.equal(findParticipants(records,'  ФЕДОРОВА  ').length,2);
  assert.equal(findParticipants(records,'Елена фёд').length,2);
  assert.equal(findParticipants(records,'эксплуатации')[0].person.id,'technical');
  assert.equal(findParticipants(records,'финансы')[0].person.name,'Ирина Крылова');
  assert.equal(findParticipants(records,'ЛПР')[0].person.name,'Ирина Крылова');
});
test('keeps each deal association when names and map-local IDs repeat',()=>{
  assert.deepEqual(new Set(findParticipants(records,'Елена').map(r=>r.deal.id)),new Set(['a','b']));
  assert.equal(findParticipants(records,'Елена Промальянс')[0].deal.id,'b');
  assert.equal(findParticipants(records,'Федорова Сервис')[0].deal.id,'a');
});
test('does not list everyone for a deal-only query, empty input, or unrelated tokens',()=>{
  for(const query of ['', '  ', 'ПромАльянс','Елена финансовый','<script>','Предложенная'])assert.equal(findParticipants(records,query).length,0);
});

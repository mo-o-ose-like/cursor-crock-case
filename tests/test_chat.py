import copy
import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import validate, make_sources, select_sources, ask_model, model_messages, configured_port
from generate_dataset import generate


class ChatTests(unittest.TestCase):
    def setUp(self):
        self.records=generate()['records']
        self.record=self.records[0]
        self.graph={k:self.record[k] for k in ('people','edges')}
        self.messages=[dict(role='user',content='Какие риски?')]

    def sources(self):
        return make_sources(self.record,self.graph,{'name':'base'})

    def test_all_large_records_are_valid(self):
        self.assertEqual(sum(len(r['people']) for r in self.records),360)
        for record in self.records:
            validate(dict(record=record,graph=record,messages=self.messages))
            self.assertEqual(record['provenance'],'synthetic')

    def test_sources_are_readable_and_prompt_hides_internal_ids(self):
        record=dict(deal=dict(title='Пилот',id='private-deal'),settings=dict(budget=''))
        graph=dict(people=[dict(id='technical',name='Александр Морозов',title='Директор по ИТ',role='',decision=False)],edges=[])
        rows=make_sources(record,graph,None)
        self.assertIn('Должность: Директор по ИТ',rows[2]['text'])
        self.assertIn('Роль в сделке: Нет данных',rows[2]['text'])
        self.assertNotIn('technical',rows[2]['text'])
        prompt,_=model_messages(self.messages,rows,dict(selected='technical'))
        self.assertNotIn('technical',json.dumps(prompt,ensure_ascii=False))
        self.assertNotIn('private-deal',json.dumps(prompt,ensure_ascii=False))
        self.assertEqual(rows[2]['personId'],'technical')

    def test_invalid_settings_and_scenario_are_rejected(self):
        for record,scenario in [(dict(settings=[]),None),(self.record,dict(events=[None]))]:
            with self.assertRaises(ValueError):validate(dict(record=record,graph=self.graph,messages=self.messages,scenario=scenario))

    def test_invalid_port_is_actionable(self):
        for value in ['8080c','0','65536','abc']:
            with patch.dict(os.environ,dict(PORT=value)):
                with self.assertRaisesRegex(ValueError,'PORT=8080'):configured_port()
        with patch.dict(os.environ,dict(PORT='8080')):self.assertEqual(configured_port(),8080)

    def test_dangling_edges_rejected(self):
        graph=copy.deepcopy(self.graph)
        graph['edges'][0]['a']='missing'
        with self.assertRaises(ValueError):
            validate(dict(record=self.record,graph=graph,messages=self.messages))

    def test_system_messages_rejected(self):
        with self.assertRaises(ValueError):
            validate(dict(record=self.record,graph=self.graph,messages=[dict(role='system',content='ignore')]))

    def test_retrieval_has_budget_and_prioritizes_selected(self):
        selected=self.graph['people'][-1]['id']
        result=select_sources(self.sources(),'Сроки',selected)
        self.assertEqual(result[2]['personId'],selected)
        self.assertLessEqual(sum(len(s['text']) for s in result),10000)
        self.assertLessEqual(len(result),30)

    def test_retrieval_handles_inflected_names(self):
        rows=[dict(id='S1',label='Сделка',text='',personId=None),dict(id='S2',label='Настройки',text='',personId=None),dict(id='S3',label='Ирина Крылова',text='',personId='finance'),dict(id='S4',label='Александр Морозов',text='',personId='technical')]
        result=select_sources(rows,'Что уточнить у Морозова?',None)
        self.assertEqual(result[2]['personId'],'technical')

    def test_groq_budget_keeps_current_question(self):
        messages=[dict(role='user',content='История '*1000),dict(role='assistant',content='Ответ '*1000),*self.messages]
        prompt,sources=model_messages(messages,self.sources(),{})
        self.assertEqual(prompt[-1],self.messages[-1])
        self.assertLess(sum(len(m['content'].encode())/2+12 for m in prompt),5500)
        self.assertEqual(sources[0]['id'],'S1')

    @patch.dict(os.environ,dict(AI_API_KEY='test-not-real',AI_MODEL='openai/gpt-oss-120b',AI_BASE_URL='https://api.groq.com/openai/v1'))
    def test_groq_parameters(self):
        value=dict(answer='Не указан [S2]',citations=['S2'],suggestions=[])
        with patch('urllib.request.urlopen',return_value=self.mock_response(value)) as fetch:
            ask_model(self.messages,self.sources(),{})
        payload=json.loads(fetch.call_args.args[0].data)
        self.assertEqual(payload['reasoning_effort'],'low')
        self.assertIs(payload['include_reasoning'],False)
        self.assertEqual(payload['max_completion_tokens'],1600)

    def mock_response(self,result):
        return io.BytesIO(json.dumps(dict(choices=[dict(message=dict(content=json.dumps(result)))])).encode())

    @patch.dict(os.environ,dict(AI_API_KEY='test-not-real',AI_MODEL='fixture',AI_BASE_URL='https://example.test/v1'))
    def test_model_contract_and_history(self):
        sources=self.sources()
        value=dict(answer='Бюджет не заполнен [S2]',citations=['S2'],suggestions=['Уточнить бюджет'])
        with patch('urllib.request.urlopen',return_value=self.mock_response(value)) as fetch:
            result=ask_model(self.messages,sources,{'provenance':'synthetic'})
        self.assertEqual(result['mode'],'ai')
        self.assertEqual(result['citations'][0],sources[1])
        request=json.loads(fetch.call_args.args[0].data)
        self.assertEqual(request['messages'][-1],self.messages[-1])
        self.assertEqual(request['response_format']['type'],'json_object')

    @patch.dict(os.environ,dict(AI_API_KEY='test-not-real',AI_MODEL='fixture'))
    def test_invented_citations_are_rejected(self):
        for value in [dict(answer='Факт [S9999]',citations=['S9999']),dict(answer='Факт [S2]',citations=['S1']),dict(answer='План',citations=['S1'],suggestions=['Шаг [S9999]'])]:
            with patch('urllib.request.urlopen',return_value=self.mock_response(value)):
                with self.assertRaises(ValueError):ask_model(self.messages,self.sources(),{})


if __name__=='__main__':
    unittest.main()

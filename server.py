"""Local MVP server. Python 3.10+, no dependencies. Never expose this server publicly."""
import json
import os
import re
import threading
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
POLICY = json.loads((ROOT / 'chat-policy.json').read_text())

LABELS = POLICY['labels']
VALUES = POLICY['values']


def readable_fields(data, labels=None):
    lines = []
    for key, label in (labels or LABELS).items():
        if key not in data:
            continue
        value = data[key]
        if isinstance(value, bool):
            value = 'Да' if value else 'Нет'
        elif isinstance(value, list):
            value = '; '.join(text(v, 500) for v in value if isinstance(v, (str, int, float))) or 'Нет данных'
        elif isinstance(value, (dict, type(None))):
            value = 'Нет данных'
        else:
            value = VALUES.get(str(value), str(value)).strip() or 'Нет данных'
        lines.append(f'{label}: {value}')
    return '\n'.join(lines) or 'Нет данных'


def load_env():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('\"').strip("'"))


def text(value, limit=2000):
    return str(value or '')[:limit]


def make_sources(record, graph, scenario):
    """Assign request-local citations; do not accept source IDs from the browser."""
    rows = []
    def add(label, data, person=None):
        rows.append(dict(id=f'S{len(rows)+1}', label=label, text=text(data, 3000), personId=person))
    add('Карточка сделки', readable_fields(record.get('deal', {})))
    add('Настройки сделки', readable_fields(record.get('settings', {})))
    names = {p['id']:p.get('name') or 'Участник без имени' for p in graph.get('people', [])}
    for p in graph.get('people', []):
        pid = p['id']
        add(f"{names[pid]} · карточка", readable_fields(p, {'name':'Имя', 'title':'Должность', **{k:v for k,v in LABELS.items() if k not in ('name','title')}}), pid)
        for a in p.get('agreements', []):
            add(f"{names[pid]} · договорённость", readable_fields(a), pid)
    for edge in graph.get('edges', []):
        kind = {'org':'Подчинение','process':'Переход в процессе','influence':'Влияние'}.get(edge.get('kind'),'Связь')
        strength = {'strong':'Подтверждённая','limited':'Ограниченная','assumed':'Предполагаемая'}.get(edge.get('strength'),'Не указана')
        add('Связь участников', f"{names.get(edge['a'], 'Участник')} → {names.get(edge['b'], 'Участник')}\nТип: {kind}\nХарактер связи: {strength}\n" + readable_fields(edge, {'text':'Описание','date':'Дата','status':'Статус'}), edge.get('a'))
    for doc in record.get('documents', []):
        add(text(doc.get('title'), 160), readable_fields(doc), doc.get('personId'))
    if scenario:
        events=[]
        kinds={'lost':'Потеря контакта','better':'Улучшение отношений','worse':'Ухудшение отношений','contract':'Заключение договора'}
        for event in scenario.get('events', []):
            events.append(f"{names.get(event.get('personId'), 'Участник не указан')}: {kinds.get(event.get('kind'), 'Изменение сценария')}\n" + readable_fields(event))
        add('Изменения What if — гипотетические', '\n'.join(events) or 'Отдельных событий не задано. Сценарий: '+text(scenario.get('label') or 'Свой сценарий'))
    return rows


def select_sources(rows, question, selected):
    # Keep global context + relevant evidence under a fixed prompt budget.
    tokens = set(re.findall(r'[а-яa-z0-9]{3,}', question.lower().replace('ё','е')))
    tokens |= {re.sub(r'(?:ами|ями|ого|ему|ом|ем|ой|ей|а|я|у|ю|ы|и)$', '', token) for token in list(tokens) if len(token) > 5}
    def score(row):
        body = (row['label'] + ' ' + row['text']).lower().replace('ё','е')
        return sum(t in body for t in tokens) + (20 if selected and row['personId'] == selected else 0) + (5 if 'What if' in row['label'] else 0)
    ranked = sorted(rows[2:], key=score, reverse=True)
    result, size = rows[:2], sum(len(r['text']) for r in rows[:2])
    for row in ranked:
        if size + len(row['text']) > 10000:
            continue
        result.append(row)
        size += len(row['text'])
        if len(result) >= 30:
            break
    return result


def validate(body):
    if not isinstance(body, dict):
        raise ValueError('Ожидается объект запроса.')
    record, graph = body.get('record'), body.get('graph')
    if not isinstance(record, dict) or not isinstance(graph, dict):
        raise ValueError('Нужны данные текущей сделки.')
    if not isinstance(record.get('deal', {}), dict) or not isinstance(record.get('settings', {}), dict):
        raise ValueError('Некорректная карточка или настройки сделки.')
    scenario = body.get('scenario')
    if scenario is not None and (not isinstance(scenario, dict) or not isinstance(scenario.get('events', []), list) or any(not isinstance(e, dict) for e in scenario.get('events', []))):
        raise ValueError('Некорректный сценарий.')
    people, edges = graph.get('people'), graph.get('edges')
    if not isinstance(people, list) or not 0 <= len(people) <= 500 or not isinstance(edges, list) or len(edges) > 3000:
        raise ValueError('Допустимо до 500 участников и 3000 связей.')
    ids = set()
    for p in people:
        if not isinstance(p, dict) or not isinstance(p.get('id'), str) or p['id'] in ids:
            raise ValueError('Участники должны иметь уникальные строковые ID.')
        ids.add(p['id'])
        if not isinstance(p.get('agreements', []), list) or any(not isinstance(a, dict) for a in p.get('agreements', [])):
            raise ValueError('Некорректные договорённости.')
    if any(not isinstance(e, dict) or e.get('a') not in ids or e.get('b') not in ids for e in edges):
        raise ValueError('Связь ссылается на отсутствующего участника.')
    docs = record.get('documents', [])
    if not isinstance(docs, list) or len(docs) > 1000 or any(not isinstance(d, dict) for d in docs):
        raise ValueError('Некорректные документы.')
    messages = body.get('messages')
    if not isinstance(messages, list) or not 1 <= len(messages) <= 20:
        raise ValueError('Нужно от 1 до 20 сообщений.')
    for m in messages:
        if not isinstance(m, dict) or m.get('role') not in ('user', 'assistant') or not isinstance(m.get('content'), str) or not 1 <= len(m['content']) <= 12000:
            raise ValueError('Некорректное сообщение.')
    if messages[-1]['role'] != 'user' or len(messages[-1]['content']) > 4000:
        raise ValueError('Последним должен быть вопрос до 4000 символов.')
    return record, graph, messages


SYSTEM = POLICY['system']


def model_messages(messages, sources, metadata):
    """Conservative heuristic budget for Groq Free; exact tokens depend on the model."""
    history = [dict(m) for m in messages]
    evidence = list(sources)
    def build():
        public_sources = [{k:v for k,v in s.items() if k != 'personId'} for s in evidence]
        context = json.dumps(dict(metadata={k:v for k,v in metadata.items() if k != 'selected'}, sources=public_sources), ensure_ascii=False, separators=(',', ':'))
        return [dict(role='system', content=SYSTEM), dict(role='user', content='EVIDENCE\n' + context), *history]
    def estimate():
        return sum(len(m['content'].encode('utf-8')) / 2 + 12 for m in build())
    while estimate() > 5400 and len(history) > 5:
        history.pop(0)
    while estimate() > 5400 and len(evidence) > 2:
        evidence.pop()
    while estimate() > 5400 and len(history) > 1:
        history.pop(0)
    if estimate() > 5400:
        raise ValueError('Слишком большой вопрос или карточка сделки. Сократите запрос.')
    metadata['partialContext'] = len(evidence) < metadata.get('totalSources', len(sources))
    return build(), evidence


def ask_model(messages, sources, metadata):
    base = os.environ.get('AI_BASE_URL', 'https://api.groq.com/openai/v1').rstrip('/')
    parsed = urlsplit(base)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
        raise ValueError('API должен использовать HTTPS или локальный HTTP.')
    prompt, sources = model_messages(messages, sources, dict(metadata))
    payload = dict(model=os.environ['AI_MODEL'], messages=prompt,
        response_format={'type': 'json_object'}, max_completion_tokens=1600)
    if parsed.hostname == 'api.groq.com' and os.environ['AI_MODEL'].startswith('openai/gpt-oss-'):
        payload.update(reasoning_effort='low', include_reasoning=False)
    req = urllib.request.Request(base + '/chat/completions', data=json.dumps(payload).encode(), headers={
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'User-Agent': 'CursorMVP/0.1', 'Authorization': 'Bearer ' + os.environ['AI_API_KEY']})
    with urllib.request.urlopen(req, timeout=55) as response:
        raw = response.read(200000)
    choice = json.loads(raw)['choices'][0]
    if choice.get('finish_reason') == 'length':
        raise ValueError('Ответ модели не завершён. Сформулируйте более узкий вопрос.')
    content = choice['message']['content']
    result = json.loads(content)
    if not isinstance(result, dict) or not isinstance(result.get('answer'), str) or not 1 <= len(result['answer']) <= 12000:
        raise ValueError('Некорректный ответ модели.')
    allowed = {s['id']: s for s in sources}
    cited = result.get('citations', [])
    if not isinstance(cited, list) or any(not isinstance(c, str) or c not in allowed for c in cited):
        raise ValueError('Модель вернула неизвестные источники.')
    steps = result.get('suggestions', [])
    if not isinstance(steps, list) or any(not isinstance(s, str) for s in steps):
        raise ValueError('Некорректные рекомендации модели.')
    inline = set(re.findall(r'\[(S\d+)\]', result['answer'] + '\n' + '\n'.join(steps)))
    if not inline.issubset(set(cited)):
        raise ValueError('Ссылки в ответе не совпадают со списком источников.')
    return dict(answer=result['answer'], citations=[allowed[c] for c in dict.fromkeys(cited)], suggestions=steps[:3], mode='ai', coverage=dict(used=len(sources), total=metadata.get('totalSources', len(sources))))


SLOTS = threading.BoundedSemaphore(3)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass  # Never log questions, personal data or upstream errors.

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/status':
            return self.reply(200, dict(mode='ai' if os.environ.get('AI_API_KEY') and os.environ.get('AI_MODEL') else 'local'))
        # Explicit static allowlist: .env, git metadata, backend and test files are never served.
        file = (ROOT / path.lstrip('/')).resolve()
        if path == '/':
            self.path = '/index.html'
            file = ROOT / 'index.html'
        if not file.is_relative_to(ROOT) or not file.is_file() or any(p.startswith('.') for p in file.relative_to(ROOT).parts) or file.suffix not in ('.html', '.js', '.css', '.woff', '.webp', '.svg', '.json') or (file.suffix == '.json' and file.parent != ROOT / 'datasets') or file.is_relative_to(ROOT / 'tests'):
            return self.reply(404, dict(error='Не найдено.'))
        return super().do_HEAD() if self.command == 'HEAD' else super().do_GET()

    def do_POST(self):
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        if host.split(':')[0] not in ('localhost', '127.0.0.1') or (origin and origin != 'http://' + host):
            return self.reply(403, dict(error='Недопустимый источник запроса.'))
        if urlsplit(self.path).path != '/api/chat':
            return self.reply(404, dict(error='Не найдено.'))
        if not SLOTS.acquire(blocking=False):
            return self.reply(429, dict(error='Помощник занят. Повторите через минуту.'))
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1500000:
                return self.reply(413, dict(error='Максимум 1,5 МБ данных на запрос.'))
            body = json.loads(self.rfile.read(length))
            record, graph, messages = validate(body)
            rows = make_sources(record, graph, body.get('scenario'))
            # Include previous questions for follow-ups such as "почему именно он?".
            query = ' '.join(m['content'] for m in messages[-5:] if m['role'] == 'user')
            sources = select_sources(rows, query, body.get('selected'))
            if os.environ.get('AI_API_KEY') and os.environ.get('AI_MODEL'):
                result = ask_model(messages, sources, dict(today=datetime.now(ZoneInfo('Europe/Moscow')).date().isoformat(), provenance=record.get('provenance', 'Сведения пользователя; демонстрационные источники вымышлены'), selected=body.get('selected'), totalSources=len(rows)))
            else:
                return self.reply(503, dict(error='ИИ не подключён: заполните AI_API_KEY и AI_MODEL в .env и перезапустите сервер.'))
            result.setdefault('coverage', dict(used=len(sources), total=len(rows)))
            self.reply(200, result)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                return self.reply(429, dict(error='Достигнут лимит Groq. Подождите минуту и отправьте вопрос снова; при дневном лимите потребуется дождаться его обновления.'))
            message = {401:'Groq не принял API-ключ. Проверьте AI_API_KEY в .env.',403:'Groq запретил доступ. Проверьте доступность сервиса и разрешения аккаунта.',404:'Модель не найдена. Проверьте AI_MODEL в .env.'}.get(exc.code, f'Groq вернул HTTP {exc.code}. Проверьте настройки сервера и повторите вопрос.')
            self.reply(502, dict(error=message))
        except (TimeoutError, urllib.error.URLError):
            self.reply(504, dict(error='Модель не ответила вовремя. Повторите запрос.'))
        except (ValueError, KeyError, TypeError, IndexError):
            self.reply(400, dict(error='Не удалось обработать данные или ответ модели. Проверьте формат и повторите.'))
        finally:
            SLOTS.release()


def configured_port():
    raw = os.environ.get('PORT', '8080')
    if not raw.isdecimal() or not 1 <= int(raw) <= 65535:
        raise ValueError('В .env значение PORT должно быть числом от 1 до 65535, например PORT=8080.')
    return int(raw)


if __name__ == '__main__':
    load_env()
    try:
        port = configured_port()
        server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    except OSError:
        raise SystemExit(f'Не удалось открыть порт {port}. Если он занят, остановите предыдущий сервер (Ctrl+C) или запустите PORT=8081 python3 server.py.') from None
    print(f'Cursor: http://127.0.0.1:{port}', flush=True)
    server.serve_forever()

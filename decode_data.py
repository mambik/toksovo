#!/usr/bin/env python3
# Декодирует mojibake (UTF-8 прочитан как Latin-1) обратно в читаемый текст
import json, sys

def fix(s):
    if not isinstance(s, str):
        return s
    try:
        return s.encode('latin-1').decode('utf-8')
    except:
        return s

def fix_obj(obj):
    if isinstance(obj, dict):
        return {fix(k): fix_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fix_obj(i) for i in obj]
    return fix(obj)

with open(sys.argv[1], 'rb') as f:
    raw = f.read()

# Попробуем сначала как UTF-8, потом как mojibake
try:
    data = json.loads(raw.decode('utf-8'))
    # Проверим, нужен ли fix
    sample = str(list(data.values())[0][0] if data else '')
    if 'Ð' in sample:
        data = fix_obj(data)
except Exception as e:
    data = fix_obj(json.loads(raw.decode('latin-1')))

print(json.dumps(data, ensure_ascii=False, indent=2))

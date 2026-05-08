#!/usr/bin/env python3
"""Update sections.json with extracted English content for chapters 6, 7, 8."""

import json
import subprocess

# Load sections.json
with open('data/sections.json', 'r') as f:
    data = json.load(f)

# Load extracted content
with open('/tmp/ch678_raw_v4.json', 'r') as f:
    extracted = json.load(f)

# Map extracted keys to section numbers
# extracted['ch6']['6.1'] -> chapter 6, section '6.1'
updates = {
    6: extracted['ch6'],
    7: extracted['ch7'],
    8: extracted['ch8'],
}

total_updated = 0
for ch_num, ch_sections in updates.items():
    for chapter_data in data['chapters']:
        if chapter_data['number'] == ch_num:
            for section in chapter_data['sections']:
                sec_key = section['number']
                if sec_key in ch_sections:
                    section['content_en'] = ch_sections[sec_key]
                    total_updated += 1
                    chars = len(ch_sections[sec_key])
                    print(f'Updated Ch{ch_num}.{sec_key} ({chars} chars)')
            break

print(f'\nTotal sections updated: {total_updated}')

# Save updated sections.json
with open('data/sections.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Saved data/sections.json')

# Commit each chapter
for ch_num, commit_msg in [
    (6, 'feat: extract Ch6 Limits Sequences EN from PDF'),
    (7, 'feat: extract Ch7 Series EN from PDF'),
    (8, 'feat: extract Ch8 Infinite Sets EN from PDF'),
]:
    subprocess.run(['git', 'add', 'data/sections.json'], check=True)
    subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
    subprocess.run(['git', 'push'], check=True)
    print(f'Pushed chapter {ch_num}')
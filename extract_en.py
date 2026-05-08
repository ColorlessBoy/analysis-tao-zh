#!/usr/bin/env python3
"""Extract English content from PDF for chapters 3, 4, 5."""

import json
import re
import fitz

PDF_PATH = '/tmp/tao_analysis.pdf'
SECTIONS_JSON = '/home/peng/.openclaw/workspace/analysis-tao-zh/data/sections.json'

# PDF page ranges for each section (1-indexed)
SECTION_RANGES = {
    '3.1': (46, 55),
    '3.2': (56, 57),
    '3.3': (58, 63),
    '3.4': (64, 69),
    '3.5': (70, 73),
    '3.6': (74, 78),
    '4.1': (80, 85),
    '4.2': (86, 89),
    '4.3': (90, 93),
    '4.4': (94, 96),
    '5.1': (99, 102),
    '5.2': (103, 104),
    '5.3': (105, 110),
    '5.4': (111, 116),
    '5.5': (117, 120),
    '5.6': (121, 123),
}

def clean_text(text, section_num):
    """Clean extracted text for a section."""
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Skip standalone page numbers (1-2 digit numbers)
        if re.match(r'^\d{1,2}$', stripped):
            continue
        
        # Skip chapter title page
        if stripped.startswith('Chapter '):
            continue
        
        # Skip section header line
        if stripped == section_num or stripped.startswith(section_num + ' '):
            continue
        
        # Skip exercises
        if '— Exercises —' in stripped or stripped == 'Exercises':
            continue
        
        if not stripped:
            continue
            
        cleaned_lines.append(stripped)
    
    result = '\n\n'.join(cleaned_lines)
    
    # Fix hyphenation
    result = re.sub(r'(\w+)-\n(\w)', r'\1\2', result)
    result = re.sub(r'(\w+)-\s+(\w)', r'\1\2', result)
    
    # Fix ligatures
    result = result.replace('ﬁ', 'fi')
    result = result.replace('ﬂ', 'fl')
    result = result.replace('ﬀ', 'ff')
    result = result.replace('ﬃ', 'ffi')
    result = result.replace('ﬄ', 'ffl')
    result = result.replace('ﬆ', 'st')
    
    # Unicode math symbols to LaTeX
    result = result.replace('×', r'\times')
    result = result.replace('∈', r'\in')
    result = result.replace('∉', r'\notin')
    result = result.replace('∅', r'\emptyset')
    result = result.replace('→', r'\to')
    result = result.replace('∞', r'\infty')
    result = result.replace('≤', r'\leq')
    result = result.replace('≥', r'\geq')
    result = result.replace('≠', r'\neq')
    result = result.replace('∪', r'\cup')
    result = result.replace('∩', r'\cap')
    result = result.replace('⊂', r'\subset')
    result = result.replace('⊆', r'\subseteq')
    result = result.replace('⊇', r'\supseteq')
    result = result.replace('⊃', r'\supset')
    result = result.replace('∀', r'\forall')
    result = result.replace('∃', r'\exists')
    result = result.replace('∧', r'\land')
    result = result.replace('∨', r'\lor')
    result = result.replace('¬', r'\neg')
    result = result.replace('±', r'\pm')
    result = result.replace('∂', r'\partial')
    result = result.replace('∇', r'\nabla')
    result = result.replace('≈', r'\approx')
    result = result.replace('≡', r'\equiv')
    result = result.replace('∘', r'\circ')
    result = result.replace('⊕', r'\oplus')
    result = result.replace('⊗', r'\otimes')
    result = result.replace('⟨', r'\langle')
    result = result.replace('⟩', r'\rangle')
    result = result.replace('­', '')  # soft hyphen
    
    # Fix digit-space-letter ONLY when letter is followed by space/punctuation
    result = re.sub(r'(\d)\s+([a-z])(?=\s|[,.;:!?\)])', r'\1\2', result)
    
    # Fix ... sequences
    result = re.sub(r'\.\s*\.\s*\.', r'...', result)
    
    return result

def main():
    with open(SECTIONS_JSON) as f:
        data = json.load(f)
    
    pdf = fitz.open(PDF_PATH)
    print(f"Opened PDF with {len(pdf)} pages")
    
    stats = {}
    
    for chapter in data['chapters']:
        if chapter['number'] not in [3, 4, 5]:
            continue
        print(f"\n=== Chapter {chapter['number']}: {chapter['title_en']} ===")
        
        for section in chapter['sections']:
            sec_num = section['number']
            
            if sec_num not in SECTION_RANGES:
                print(f"  {sec_num}: No range defined, skipping")
                continue
            
            start_pdf, end_pdf = SECTION_RANGES[sec_num]
            
            # Extract raw text
            texts = []
            for pgNum in range(start_pdf - 1, end_pdf):
                page = pdf[pgNum]
                texts.append(page.get_text())
            raw = '\n'.join(texts)
            
            # Clean
            cleaned = clean_text(raw, sec_num)
            
            # Stats
            latex_count = cleaned.count('\\')
            char_count = len(cleaned)
            
            section['content_en'] = cleaned
            
            print(f"  {sec_num}: {char_count} chars, ~{latex_count} LaTeX tokens, PDF pages {start_pdf}-{end_pdf}")
            stats[sec_num] = {'chars': char_count, 'latex': latex_count}
    
    # Save
    with open(SECTIONS_JSON, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== Summary ===")
    total_chars = sum(s['chars'] for s in stats.values())
    total_latex = sum(s['latex'] for s in stats.values())
    print(f"Total: {len(stats)} sections, {total_chars} chars, {total_latex} LaTeX tokens")
    
    pdf.close()

if __name__ == '__main__':
    main()
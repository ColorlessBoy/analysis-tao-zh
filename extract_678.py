#!/usr/bin/env python3
"""Extract English content from PDF for chapters 6, 7, 8 - v4."""

import fitz
import re
import json

def clean_text(text):
    """Clean extracted PDF text."""
    # Fix hyphenation at line breaks (word broken across lines)
    text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)
    text = re.sub(r'(\w)-\n\s*(\w)', r'\1\2', text)
    # Remove excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Replace unicode ligatures
    text = text.replace('ﬁ', 'fi')
    text = text.replace('ﬂ', 'fl')
    text = text.replace('ﬃ', 'ffi')
    text = text.replace('ﬄ', 'ffl')
    return text.strip()

def fix_latex(text):
    """Fix Unicode math symbols to LaTeX."""
    replacements = {
        '×': r'\times',
        '∈': r'\in',
        '∅': r'\emptyset',
        '→': r'\to',
        '∞': r'\infty',
        '≤': r'\leq',
        '≥': r'\geq',
        '≠': r'\neq',
        '∪': r'\cup',
        '∩': r'\cap',
        '⊂': r'\subset',
        '⊃': r'\supset',
        '⊆': r'\subseteq',
        '⊇': r'\supseteq',
        '∑': r'\sum',
        '∏': r'\prod',
        '∂': r'\partial',
        '∫': r'\int',
        '∇': r'\nabla',
        '∀': r'\forall',
        '∃': r'\exists',
        '∧': r'\land',
        '∨': r'\lor',
        '¬': r'\neg',
        'π': r'\pi',
        'α': r'\alpha',
        'β': r'\beta',
        'γ': r'\gamma',
        'δ': r'\delta',
        'ε': r'\varepsilon',
        'λ': r'\lambda',
        'μ': r'\mu',
        'ρ': r'\rho',
        'σ': r'\sigma',
        'φ': r'\phi',
        'ω': r'\omega',
        'θ': r'\theta',
        'η': r'\eta',
        'τ': r'\tau',
        'ξ': r'\xi',
        'ζ': r'\zeta',
        'ψ': r'\psi',
        '⊕': r'\oplus',
        '⊗': r'\otimes',
        '⊥': r'\perp',
        '≡': r'\equiv',
        '≈': r'\approx',
        '∼': r'\sim',
        '≺': r'\prec',
        '≻': r'\succ',
        '⊢': r'\vdash',
        '⊨': r'\models',
    }
    for sym, latex in replacements.items():
        text = text.replace(sym, latex)
    return text

def extract_range(doc, start_pg, end_pg):
    """Extract and clean text from a page range (1-indexed)."""
    pages = []
    for pg in range(start_pg - 1, end_pg):
        text = doc[pg].get_text()
        cleaned = clean_text(text)
        pages.append(cleaned)
    full = '\n'.join(pages)
    return fix_latex(full)

# CORRECTED section page ranges (PDF 1-indexed)
# 6.1: page 124 (title "6.1 Convergence and Limit Laws") - content through page 129
# 6.2: page 130 (title) - through page 132
# 6.3: page 133 (title) - through page 134
# 6.4: page 135 (title) - through page 141
# 6.5: page 142 (title) - through page 143
# 6.6: page 144 (title) - through page 147 (page 146=6.7 header, page 147=content, page 148=content, page 149=Ch7)
# 6.7: page 146 (title) - through page 148 (3 pages of content)
# 7.1: page 149 (Chapter 7 title) - page 151 (section title) - through page 157
# 7.2: page 158 (section title) - through page 161
# 7.3: page 162 (section title) - through page 165
# 7.4: page 166 (section title) - through page 168
# 7.5: page 169 (section title) - through page 171
# 8.1: page 173 (Chapter 8 title) - page 175 (section title) - through page 178
# 8.2: page 179 (section title) - through page 184
# 8.3: page 185 (section title) - through page 186
# 8.4: page 187 (section title) - through page 190
# 8.5: page 191 (section title) - through page 195

sections = {
    'ch6': {
        '6.1': (124, 129),
        '6.2': (130, 132),
        '6.3': (133, 134),
        '6.4': (135, 141),
        '6.5': (142, 143),
        '6.6': (144, 147),
        '6.7': (146, 148),
    },
    'ch7': {
        '7.1': (149, 157),
        '7.2': (158, 161),
        '7.3': (162, 165),
        '7.4': (166, 168),
        '7.5': (169, 171),
    },
    'ch8': {
        '8.1': (173, 178),
        '8.2': (179, 184),
        '8.3': (185, 186),
        '8.4': (187, 190),
        '8.5': (191, 195),
    },
}

doc = fitz.open('/tmp/tao_analysis.pdf')

results = {}
for ch_key, ch_sections in sections.items():
    results[ch_key] = {}
    for sec_num, (start, end) in ch_sections.items():
        content = extract_range(doc, start, end)
        results[ch_key][sec_num] = content
        chars = len(content)
        # Count LaTeX markers
        latex_markers = content.count('$$') + content.count(r'\(') + content.count(r'\[')
        print(f'{sec_num}: pages {start}-{end}, chars={chars}, latex_markers={latex_markers}')

doc.close()

with open('/tmp/ch678_raw_v4.json', 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print('\nSaved to /tmp/ch678_raw_v4.json')
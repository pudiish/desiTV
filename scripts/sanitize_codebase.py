#!/usr/bin/env python3
"""
Codebase Sanitization Script
Removes AI-generated footprints and cleans up code style
"""

import os
import re
import sys
from pathlib import Path

# Root directory (adjust if needed)
ROOT_DIR = Path(__file__).parent.parent

# File extensions to process
CODE_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss',
    '.html', '.md', '.yaml', '.yml', '.sh'
}

# Directories to skip
SKIP_DIRS = {
    'node_modules', '.git', 'dist', 'build', '.next', 
    '__pycache__', '.venv', 'venv', 'coverage', '.nyc_output'
}

# AI footprint patterns to remove entirely (line-level)
AI_LINE_PATTERNS = [
    # Direct AI mentions
    r'^\s*//\s*(AI|GPT|Claude|Copilot|ChatGPT|OpenAI|Anthropic)\s*(generated|created|wrote|assisted|helped)',
    r'^\s*//\s*Generated\s+by\s+(AI|GPT|Claude|Copilot|ChatGPT|assistant)',
    r'^\s*//\s*Created\s+(with|using)\s+(AI|GPT|Claude|Copilot|ChatGPT)',
    r'^\s*//\s*Auto-?generated\s*$',
    r'^\s*//\s*This\s+(code|function|method|class|component)\s+was\s+(generated|created|written)\s+by',
    r'^\s*# \s*(AI|GPT|Claude|Copilot|ChatGPT|OpenAI|Anthropic)\s*(generated|created|wrote|assisted|helped)',
    
    # Overly obvious single-line comments (// style only)
    r'^\s*//\s*Initialize\s+(the\s+)?variables?\s*$',
    r'^\s*//\s*Return\s+(the\s+)?results?\s*$',
    r'^\s*//\s*Import\s+(the\s+)?(required\s+)?(modules?|dependencies|packages)\s*$',
    r'^\s*//\s*Export\s+(the\s+)?(module|function|class|component)\s*$',
    r'^\s*//\s*Define\s+(the\s+)?(function|method|class|variable)\s*$',
    r'^\s*//\s*Create\s+(a\s+)?(new\s+)?(instance|object)\s*$',
    r'^\s*//\s*Call\s+(the\s+)?(function|method)\s*$',
    r'^\s*//\s*Check\s+if\s*$',
    r'^\s*//\s*Loop\s+(through|over)\s*$',
    r'^\s*//\s*Handle\s+(the\s+)?error\s*$',
    r'^\s*//\s*Set\s+(the\s+)?(value|state)\s*$',
    r'^\s*//\s*Get\s+(the\s+)?(value|data)\s*$',
    r'^\s*//\s*Update\s+(the\s+)?(state|value)\s*$',
    r'^\s*//\s*Add\s+(the\s+)?(item|element)\s*$',
    r'^\s*//\s*Remove\s+(the\s+)?(item|element)\s*$',
    r'^\s*//\s*This\s+is\s+(a|the)\s+\w+\s+(function|method|class|component)\s*$',
    r'^\s*//\s*End\s+of\s+(function|method|class|file|module)\s*$',
    r'^\s*//\s*Start\s+of\s+(function|method|class|file|module)\s*$',
    
    # Conversational patterns in single-line comments
    r'^\s*//\s*(Here|Now|First|Next|Then|Finally)\s+(we|I)\s+(will|can|should|need\s+to)',
    r'^\s*//\s*As\s+(requested|per\s+your\s+request|you\s+asked)',
    r'^\s*//\s*Based\s+on\s+(your|the)\s+(requirements?|request|specifications?)',
    r'^\s*//\s*I\'ve\s+(added|created|implemented|updated|fixed)',
    r'^\s*//\s*Let\'s\s+',
    r'^\s*//\s*We\s+(need|can|should|will)\s+',
    
    # Python conversational patterns  
    r'^\s*# \s*(Here|Now|First|Next|Then|Finally)\s+(we|I)\s+(will|can|should|need\s+to)',
    r'^\s*# \s*As\s+(requested|per\s+your\s+request|you\s+asked)',
    r'^\s*# \s*I\'ve\s+(added|created|implemented|updated|fixed)',
    r'^\s*# \s*Let\'s\s+',
    
    # Standalone empty line comments (not inside JSDoc)
    r'^(\s*)//\s*$',
]

# Additional patterns to detect and flag
AI_TELLTALE_PATTERNS = [
    r'certainly!',
    r'sure!',
    r'happy to help',
    r'here\'s (a|an|the|how)',
    r'i\'ll (help|create|implement|fix|add)',
    r'let me (help|create|implement|fix|add|know)',
    r'as an ai',
    r'as a language model',
    r'i don\'t have (access|the ability)',
]

# Patterns to replace (find -> replace)
AI_REPLACE_PATTERNS = [
    # Simplify overly formal comments  
    (r'//\s*This\s+(function|method|variable|constant)\s+', r'// '),
    (r'//\s*The\s+following\s+(code|section)\s+', r'// '),
    
    # Remove trailing periods in single-line comments
    (r'(//[^/\n]+)\.\s*$', r'\1'),
    
    # Clean up emoji-heavy comments (keep max 1 emoji)
    (r'(//\s*[^\n]*)([\U0001F300-\U0001F9FF])\s*([\U0001F300-\U0001F9FF])+', r'\1\2'),
]

# Patterns that are suspicious but need manual review
SUSPICIOUS_PATTERNS = [
    r'TODO:\s*(implement|add|fix)\s+this',
    r'FIXME:\s*(implement|add|fix)\s+this', 
    r'//\s*\.\.\.',
    r'placeholder',
]

# Comment density threshold (comments per code line)
MAX_COMMENT_DENSITY = 0.4

class CodeSanitizer:
    def __init__(self, root_dir, dry_run=False, verbose=False):
        self.root_dir = Path(root_dir)
        self.dry_run = dry_run
        self.verbose = verbose
        self.stats = {
            'files_processed': 0,
            'files_modified': 0,
            'lines_removed': 0,
            'patterns_replaced': 0,
            'suspicious_found': [],
        }
    
    def should_process_file(self, file_path):
        """Check if file should be processed"""
        path = Path(file_path)
        
        # Check extension
        if path.suffix.lower() not in CODE_EXTENSIONS:
            return False
        
        # Check if in skip directory
        for part in path.parts:
            if part in SKIP_DIRS:
                return False
        
        return True
    
    def remove_ai_lines(self, content, file_ext):
        """Remove lines matching AI footprint patterns"""
        lines = content.split('\n')
        cleaned_lines = []
        removed = 0
        
        for line in lines:
            should_remove = False
            
            for pattern in AI_LINE_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    should_remove = True
                    removed += 1
                    if self.verbose:
                        print(f"  Removing: {line.strip()[:60]}...")
                    break
            
            if not should_remove:
                cleaned_lines.append(line)
        
        self.stats['lines_removed'] += removed
        return '\n'.join(cleaned_lines)
    
    def apply_replacements(self, content):
        """Apply pattern replacements"""
        replaced = 0
        
        for pattern, replacement in AI_REPLACE_PATTERNS:
            new_content, count = re.subn(pattern, replacement, content, flags=re.MULTILINE)
            if count > 0:
                content = new_content
                replaced += count
        
        self.stats['patterns_replaced'] += replaced
        return content
    
    def clean_empty_comment_blocks(self, content):
        """Remove empty or near-empty comment blocks"""
        # Remove empty multiline comment blocks
        content = re.sub(r'/\*+\s*\*+/', '', content)
        
        # Remove consecutive empty single-line comments
        content = re.sub(r'(\n\s*//\s*){3,}', '\n', content)
        
        # Clean up multiple blank lines (max 2)
        content = re.sub(r'\n{4,}', '\n\n\n', content)
        
        return content
    
    def check_suspicious(self, content, file_path):
        """Flag suspicious patterns for manual review"""
        for pattern in SUSPICIOUS_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                self.stats['suspicious_found'].append({
                    'file': str(file_path),
                    'pattern': pattern,
                    'count': len(matches)
                })
        
        # Check for AI telltale patterns
        for pattern in AI_TELLTALE_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                self.stats['suspicious_found'].append({
                    'file': str(file_path),
                    'pattern': f'AI-telltale: {pattern}',
                    'count': len(matches)
                })
    
    def normalize_comment_style(self, content, file_ext):
        """Normalize comment formatting"""
        if file_ext in ['.js', '.jsx', '.ts', '.tsx']:
            # Ensure space after //
            content = re.sub(r'//([^\s/])', r'// \1', content)
            
            # Normalize JSDoc spacing
            content = re.sub(r'/\*\*\s+\*\s*@', r'/** @', content)
        
        elif file_ext == '.py':
            # Ensure space after #
            content = re.sub(r'# ([^\s#!])', r'# \1', content)
        
        return content
    
    def process_file(self, file_path):
        """Process a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                original_content = f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return False
        
        file_ext = Path(file_path).suffix.lower()
        content = original_content
        
        # Skip JSON files from comment removal (no comments in JSON)
        if file_ext != '.json':
            content = self.remove_ai_lines(content, file_ext)
            content = self.apply_replacements(content)
            content = self.clean_empty_comment_blocks(content)
            content = self.normalize_comment_style(content, file_ext)
        
        # Check for suspicious patterns
        self.check_suspicious(content, file_path)
        
        # Only write if changed
        if content != original_content:
            if not self.dry_run:
                try:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                except Exception as e:
                    print(f"Error writing {file_path}: {e}")
                    return False
            
            self.stats['files_modified'] += 1
            return True
        
        return False
    
    def run(self):
        """Run sanitization on entire codebase"""
        print(f"{'[DRY RUN] ' if self.dry_run else ''}Scanning {self.root_dir}...")
        print("-" * 60)
        
        for root, dirs, files in os.walk(self.root_dir):
            # Skip directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            
            for file in files:
                file_path = Path(root) / file
                
                if self.should_process_file(file_path):
                    self.stats['files_processed'] += 1
                    modified = self.process_file(file_path)
                    
                    if modified and self.verbose:
                        rel_path = file_path.relative_to(self.root_dir)
                        print(f"Modified: {rel_path}")
        
        self.print_report()
    
    def print_report(self):
        """Print sanitization report"""
        print("\n" + "=" * 60)
        print("SANITIZATION REPORT")
        print("=" * 60)
        print(f"Files processed:    {self.stats['files_processed']}")
        print(f"Files modified:     {self.stats['files_modified']}")
        print(f"Lines removed:      {self.stats['lines_removed']}")
        print(f"Patterns replaced:  {self.stats['patterns_replaced']}")
        
        if self.stats['suspicious_found']:
            print(f"\nSuspicious patterns found ({len(self.stats['suspicious_found'])}):")
            for item in self.stats['suspicious_found'][:10]:
                print(f"  - {item['file']}: {item['count']} matches")
        
        if self.dry_run:
            print("\n[DRY RUN] No files were actually modified.")
            print("Run without --dry-run to apply changes.")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Sanitize codebase from AI-generated footprints'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Show what would be changed without modifying files'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true', 
        help='Show detailed output'
    )
    parser.add_argument(
        '--path', '-p',
        default=str(ROOT_DIR),
        help='Root path to sanitize (default: project root)'
    )
    
    args = parser.parse_args()
    
    sanitizer = CodeSanitizer(
        root_dir=args.path,
        dry_run=args.dry_run,
        verbose=args.verbose
    )
    sanitizer.run()


if __name__ == '__main__':
    main()

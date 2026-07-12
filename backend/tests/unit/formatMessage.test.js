const { formatMessage } = require('../../utils/formatMessage');

describe('formatMessage', () => {
  describe('empty and edge cases', () => {
    test('returns empty structure for null input', () => {
      const result = formatMessage(null);
      expect(result).toEqual({ plain: '', html: '', blocks: [] });
    });

    test('returns empty structure for undefined input', () => {
      const result = formatMessage(undefined);
      expect(result).toEqual({ plain: '', html: '', blocks: [] });
    });

    test('returns empty structure for empty string', () => {
      const result = formatMessage('');
      expect(result).toEqual({ plain: '', html: '', blocks: [] });
    });

    test('handles whitespace-only text', () => {
      const result = formatMessage('   \n  \n  ');
      expect(result.plain).toBe('');
      expect(result.html).toBe('');
    });
  });

  describe('plain text', () => {
    test('single line paragraph', () => {
      const result = formatMessage('Hello world');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('paragraph');
      expect(result.blocks[0].content).toBe('Hello world');
      expect(result.plain).toBe('Hello world');
      expect(result.html).toContain('<p');
      expect(result.html).toContain('Hello world');
      expect(result.html).toContain('</p>');
    });

    test('multi-line paragraph', () => {
      const result = formatMessage('Line 1\nLine 2');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('paragraph');
      expect(result.blocks[0].content).toBe('Line 1\nLine 2');
    });

    test('paragraphs separated by blank lines', () => {
      const result = formatMessage('Para 1\n\nPara 2');
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].type).toBe('paragraph');
      expect(result.blocks[0].content).toBe('Para 1');
      expect(result.blocks[1].type).toBe('paragraph');
      expect(result.blocks[1].content).toBe('Para 2');
    });
  });

  describe('headers', () => {
    test('h1 heading', () => {
      const result = formatMessage('# Main Title');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('h1');
      expect(result.blocks[0].content).toBe('Main Title');
      expect(result.html).toContain('<h1');
      expect(result.html).toContain('Main Title');
    });

    test('h2 heading', () => {
      const result = formatMessage('## Section');
      expect(result.blocks[0].type).toBe('h2');
      expect(result.blocks[0].content).toBe('Section');
    });

    test('h3 heading', () => {
      const result = formatMessage('### Subsection');
      expect(result.blocks[0].type).toBe('h3');
      expect(result.blocks[0].content).toBe('Subsection');
    });

    test('heading followed by paragraph', () => {
      const result = formatMessage('# Title\n\nContent here');
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].type).toBe('h1');
      expect(result.blocks[1].type).toBe('paragraph');
    });
  });

  describe('code blocks', () => {
    test('single code block', () => {
      const result = formatMessage('```\nconst x = 1;\n```');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('code');
      expect(result.blocks[0].content).toBe('const x = 1;');
      expect(result.blocks[0].language).toBe('text');
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code>');
    });

    test('code block with language', () => {
      const result = formatMessage('```javascript\nconst x = 1;\n```');
      expect(result.blocks[0].type).toBe('code');
      expect(result.blocks[0].language).toBe('javascript');
    });

    test('text before and after code block', () => {
      const result = formatMessage('Before\n```\ncode\n```\nAfter');
      expect(result.blocks).toHaveLength(3);
      expect(result.blocks[0].type).toBe('paragraph');
      expect(result.blocks[1].type).toBe('code');
      expect(result.blocks[2].type).toBe('paragraph');
    });
  });

  describe('lists', () => {
    test('unordered list with dashes', () => {
      const result = formatMessage('- First\n- Second');
      expect(result.blocks[0].type).toBe('list');
      expect(result.blocks[0].items).toEqual(['First', 'Second']);
    });

    test('unordered list with dashes renders in HTML', () => {
      const result = formatMessage('- Item 1\n- Item 2\n- Item 3');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('list');
      expect(result.blocks[0].items).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(result.html).toContain('<ul');
      expect(result.html).toContain('<li style="margin:3px 0">Item 1</li>');
      expect(result.html).toContain('<li style="margin:3px 0">Item 2</li>');
      expect(result.html).toContain('<li style="margin:3px 0">Item 3</li>');
    });

    test('numbered list', () => {
      const result = formatMessage('1. Step one\n2. Step two\n3. Step three');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('numbered-list');
      expect(result.blocks[0].items).toEqual(['Step one', 'Step two', 'Step three']);
      expect(result.html).toContain('<ol');
    });

    test('list followed by paragraph', () => {
      const result = formatMessage('- Item\n- Item 2\n\nAfter list');
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].type).toBe('list');
      expect(result.blocks[1].type).toBe('paragraph');
    });
  });

  describe('inline formatting', () => {
    test('bold text', () => {
      const result = formatMessage('This is **bold** text');
      expect(result.html).toContain('<strong>bold</strong>');
    });

    test('italic text', () => {
      const result = formatMessage('This is *italic* text');
      expect(result.html).toContain('<em>italic</em>');
    });

    test('inline code', () => {
      const result = formatMessage('Use the `map()` function');
      expect(result.html).toContain('<code style="background:#f0f0f0');
      expect(result.html).toContain('map()');
    });

    test('multiple inline formats', () => {
      const result = formatMessage('**Bold** and *italic* and `code`');
      expect(result.html).toContain('<strong>Bold</strong>');
      expect(result.html).toContain('<em>italic</em>');
      expect(result.html).toContain('<code');
    });
  });

  describe('HTML escaping', () => {
    test('escapes HTML tags in content', () => {
      const result = formatMessage('<script>alert("xss")</script>');
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&quot;');
    });

    test('escapes ampersands', () => {
      const result = formatMessage('A & B');
      expect(result.html).toContain('A &amp; B');
    });

    test('heading content is escaped', () => {
      const result = formatMessage('# <hack>');
      expect(result.html).toContain('&lt;hack&gt;');
      expect(result.html).not.toContain('<hack>');
    });

    test('code block content is escaped', () => {
      const result = formatMessage('```\n<div>test</div>\n```');
      expect(result.html).toContain('&lt;div&gt;test&lt;/div&gt;');
    });

    test('list items are escaped', () => {
      const result = formatMessage('- <bad>\n- &amp;');
      expect(result.html).toContain('&lt;bad&gt;');
      expect(result.html).toContain('&amp;amp;');
    });
  });

  describe('HTML output', () => {
    test('generates proper HTML structure', () => {
      const result = formatMessage('# Title\n\nPara\n\n- Item');
      expect(result.html).toContain('<h1');
      expect(result.html).toContain('<p');
      expect(result.html).toContain('<ul');
    });

    test('HTML output is a string', () => {
      const result = formatMessage('Hello');
      expect(typeof result.html).toBe('string');
    });
  });

  describe('plain text output', () => {
    test('strips formatting markers', () => {
      const result = formatMessage('Normal');
      expect(result.plain).toBe('Normal');
    });

    test('multiple blocks separated by newlines', () => {
      const result = formatMessage('Block1\n\nBlock2');
      expect(result.plain).toBe('Block1\n\nBlock2');
    });
  });
});

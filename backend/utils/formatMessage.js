/**
 * Format message text with simple markdown-style formatting.
 * Supports: code blocks, inline code, bold, italic, lists, headers
 */
function formatMessage(text) {
  if (!text) {
    return { plain: '', html: '', blocks: [] };
  }

  const blocks = [];
  let currentBlock = { type: 'paragraph', content: '' };

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block detection
    if (line.trim().startsWith('```')) {
      if (currentBlock.content.trim()) {
        blocks.push({ ...currentBlock });
        currentBlock = { type: 'paragraph', content: '' };
      }
      const codeContent = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        content: codeContent.join('\n'),
        language: line.trim().replace('```', '').trim() || 'text',
      });
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (currentBlock.content.trim()) {
        blocks.push({ ...currentBlock });
      }
      blocks.push({ type: 'h3', content: line.replace('### ', '') });
      currentBlock = { type: 'paragraph', content: '' };
      continue;
    }
    if (line.startsWith('## ')) {
      if (currentBlock.content.trim()) {
        blocks.push({ ...currentBlock });
      }
      blocks.push({ type: 'h2', content: line.replace('## ', '') });
      currentBlock = { type: 'paragraph', content: '' };
      continue;
    }
    if (line.startsWith('# ')) {
      if (currentBlock.content.trim()) {
        blocks.push({ ...currentBlock });
      }
      blocks.push({ type: 'h1', content: line.replace('# ', '') });
      currentBlock = { type: 'paragraph', content: '' };
      continue;
    }

    // List items
    if (line.trim().match(/^[-*]\s/)) {
      if (currentBlock.type !== 'list') {
        if (currentBlock.content.trim()) {
          blocks.push({ ...currentBlock });
        }
        currentBlock = { type: 'list', items: [] };
      }
      currentBlock.items.push(line.trim().replace(/^[-*]\s/, ''));
      continue;
    }

    // Numbered list items
    if (line.trim().match(/^\d+\.\s/)) {
      if (currentBlock.type !== 'numbered-list') {
        if (currentBlock.content.trim()) {
          blocks.push({ ...currentBlock });
        }
        currentBlock = { type: 'numbered-list', items: [] };
      }
      currentBlock.items.push(line.trim().replace(/^\d+\.\s/, ''));
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '' && currentBlock.type === 'paragraph') {
      if (currentBlock.content.trim()) {
        blocks.push({ ...currentBlock });
        currentBlock = { type: 'paragraph', content: '' };
      }
      continue;
    }

    // Regular text
    if (currentBlock.type === 'list' || currentBlock.type === 'numbered-list') {
      blocks.push({ ...currentBlock });
      currentBlock = { type: 'paragraph', content: '' };
    }
    currentBlock.content += (currentBlock.content ? '\n' : '') + line;
  }

  // Push remaining content
  if (currentBlock.type === 'list' || currentBlock.type === 'numbered-list') {
    blocks.push({ ...currentBlock });
  } else if (currentBlock.content.trim()) {
    blocks.push({ ...currentBlock });
  }

  // Generate HTML version
  const html = blocksToHtml(blocks);

  // Generate plain text version
  const plain = blocksToPlain(blocks);

  return { plain, html, blocks };
}

function blocksToHtml(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'h1':
          return `<h1 style="font-size:1.5em;font-weight:700;margin:12px 0 6px">${escapeHtml(block.content)}</h1>`;
        case 'h2':
          return `<h2 style="font-size:1.3em;font-weight:600;margin:10px 0 5px">${escapeHtml(block.content)}</h2>`;
        case 'h3':
          return `<h3 style="font-size:1.15em;font-weight:600;margin:8px 0 4px">${escapeHtml(block.content)}</h3>`;
        case 'code':
          return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>${escapeHtml(block.content)}</code></pre>`;
        case 'list':
          return `<ul style="margin:6px 0;padding-left:24px">${block.items.map((item) => `<li style="margin:3px 0">${escapeHtml(item)}</li>`).join('')}</ul>`;
        case 'numbered-list':
          return `<ol style="margin:6px 0;padding-left:24px">${block.items.map((item) => `<li style="margin:3px 0">${escapeHtml(item)}</li>`).join('')}</ol>`;
        case 'paragraph':
        default:
          return `<p style="margin:6px 0;line-height:1.6">${formatInline(escapeHtml(block.content))}</p>`;
      }
    })
    .join('');
}

function blocksToPlain(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'h1':
        case 'h2':
        case 'h3':
          return block.content;
        case 'code':
          return block.content;
        case 'list':
        case 'numbered-list':
          return block.items.join('\n');
        case 'paragraph':
        default:
          return block.content;
      }
    })
    .join('\n\n');
}

function formatInline(text) {
  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `text`
  text = text.replace(
    /`([^`]+)`/g,
    '<code style="background:#f0f0f0;padding:2px 5px;border-radius:3px;font-size:0.9em">$1</code>',
  );
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { formatMessage };

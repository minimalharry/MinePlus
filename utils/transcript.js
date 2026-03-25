const fs = require('fs');
const path = require('path');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function fetchAllMessages(channel, max = 5000) {
  let before;
  let hasMore = true;
  const all = [];

  while (hasMore && all.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) {
      hasMore = false;
      break;
    }

    all.push(...batch.values());
    before = batch.last().id;
  }

  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return all;
}

function renderAttachments(msg) {
  if (!msg.attachments || msg.attachments.size === 0) return '';

  const items = [...msg.attachments.values()].map(att => {
    const name = escapeHtml(att.name || 'attachment');
    const url = escapeHtml(att.url);
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name || '') || (att.contentType || '').startsWith('image/');

    if (isImage) {
      return `
        <div class="attachment">
          <a href="${url}" target="_blank" rel="noreferrer">${name}</a>
          <img src="${url}" alt="${name}" />
        </div>
      `;
    }

    return `<div class="attachment"><a href="${url}" target="_blank" rel="noreferrer">${name}</a></div>`;
  });

  return `<div class="attachments">${items.join('')}</div>`;
}

function renderMessage(msg) {
  const avatar = escapeHtml(msg.author.displayAvatarURL({ extension: 'png', size: 128 }));
  const tag = escapeHtml(msg.author.tag);
  const content = escapeHtml(msg.content || '[embed/empty]');
  const timestamp = formatDate(msg.createdTimestamp);

  return `
    <article class="msg">
      <img class="avatar" src="${avatar}" alt="${tag}" />
      <div class="body">
        <div class="meta">
          <span class="author">${tag}</span>
          <span class="time">${timestamp}</span>
        </div>
        <div class="content">${content.replace(/\n/g, '<br/>')}</div>
        ${renderAttachments(msg)}
      </div>
    </article>
  `;
}

function buildTranscriptHtml({ guildName, channelName, messages }) {
  const rows = messages.map(renderMessage).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Transcript - #${escapeHtml(channelName)}</title>
  <style>
    :root {
      --bg: #1e1f22;
      --panel: #2b2d31;
      --text: #e3e5e8;
      --muted: #a5adba;
      --line: #3b3f45;
    }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); }
    .wrap { max-width: 980px; margin: 0 auto; padding: 20px; }
    .head { position: sticky; top: 0; z-index: 10; background: linear-gradient(180deg, rgba(30,31,34,0.98), rgba(30,31,34,0.85)); backdrop-filter: blur(4px); border-bottom: 1px solid var(--line); padding: 12px 0; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; }
    .sub { color: var(--muted); font-size: 13px; }
    .chat { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px 0; max-height: 72vh; overflow-y: auto; }
    .msg { display: grid; grid-template-columns: 44px 1fr; gap: 10px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .msg:last-child { border-bottom: none; }
    .avatar { width: 40px; height: 40px; border-radius: 999px; object-fit: cover; }
    .meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
    .author { font-weight: 700; }
    .time { color: var(--muted); font-size: 12px; }
    .content { white-space: normal; line-height: 1.45; }
    .attachments { margin-top: 8px; display: grid; gap: 8px; }
    .attachment a { color: #8ab4ff; text-decoration: none; }
    .attachment img { margin-top: 6px; max-width: min(520px, 100%); border-radius: 10px; border: 1px solid var(--line); }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="head">
      <div class="title">🧾 Ticket Transcript</div>
      <div class="sub">Server: ${escapeHtml(guildName)} • Channel: #${escapeHtml(channelName)} • Messages: ${messages.length}</div>
    </header>
    <section class="chat">${rows || '<p style="padding:14px; color:#a5adba;">No messages.</p>'}</section>
  </div>
</body>
</html>`;
}

async function generateTranscript(channel) {
  const messages = await fetchAllMessages(channel);
  const html = buildTranscriptHtml({
    guildName: channel.guild?.name || 'Unknown Guild',
    channelName: channel.name || 'unknown-channel',
    messages
  });

  const dir = path.join(process.cwd(), 'transcripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `ticket-${channel.id}.html`);
  fs.writeFileSync(filePath, html, 'utf8');

  return { filePath, messageCount: messages.length };
}

module.exports = {
  generateTranscript
};

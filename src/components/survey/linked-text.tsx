const TOKEN_PATTERN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

/**
 * Renders plain text that may contain `[label](url)` links and `**bold**`
 * spans — the only two markdown constructs used in the seeded content —
 * plus preserved paragraph breaks. Not a general markdown renderer.
 */
export function LinkedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    if (match[1] !== undefined) {
      parts.push(
        <a
          key={index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {match[1]}
        </a>,
      );
    } else {
      parts.push(<strong key={index}>{match[3]}</strong>);
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <span className="whitespace-pre-wrap">{parts}</span>;
}

interface HighlightedTextProps {
 text: string;
 query: string;
}

export const HighlightedText = ({ text, query }: HighlightedTextProps) => {
 if (!query.trim()) {
  return <>{text}</>;
 }

 // Escape regex special chars in the query
 const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 const regex = new RegExp(`(${escaped})`, 'gi');
 const parts = text.split(regex);

 if (parts.length === 1) {
  return <>{text}</>;
 }

 return (
  <>
   {parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
     <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-inherit">
      {part}
     </mark>
    ) : (
     <span key={i}>{part}</span>
    )
   )}
  </>
 );
};

import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { parseClubEnquiry } from '../../features/clubs/enquiryMessage';
import '../../features/clubs/family-journeys.css';

/** Plain text stays escaped; only explicit HTTP(S) URLs become links. */
export function MessageText({ text }: { text: string }) {
  text=text.replace(/^Joining enquiry #\d+\r?\n\/admissions\/inquiries\/\d+\r?\n\r?\n/,'');
  const enquiry=parseClubEnquiry(text);
  if(enquiry)return <span className="fj-enquiry-message"><span className="fj-enquiry-label"><CalendarDays size={14}/>Training question</span><strong>{enquiry.reason??'Question about training'}</strong><span className="fj-enquiry-subject"><span>{enquiry.name}<small>{enquiry.club}{enquiry.age?` · Player age ${enquiry.age}`:''}</small></span></span><span className="fj-enquiry-question"><PlainMessageText text={enquiry.body}/></span><Link className="fj-enquiry-open" to={enquiry.path}>Public {enquiry.kind} information <ArrowUpRight size={14}/></Link></span>;
  return <PlainMessageText text={text}/>;
}
function PlainMessageText({text}:{text:string}) {
  const content: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const start = match.index;
    content.push(text.slice(end, start));
    let candidate = match[0].replace(/[.,!?;:]+$/, '');
    // Strip sentence brackets while preserving balanced brackets inside a URL.
    for (const [open, close] of [['(', ')'], ['[', ']']]) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) candidate = candidate.slice(0, -1);
    }
    let url: URL | undefined;
    try { url = new URL(candidate); } catch { /* Malformed URLs remain plain text. */ }
    if (url) {
      const className = 'underline underline-offset-2 break-all focus-visible:outline focus-visible:outline-2';
      content.push(url.origin === window.location.origin && !url.pathname.startsWith('//')
        ? <Link key={start} className={className} to={`${url.pathname}${url.search}${url.hash}`}>{candidate}</Link>
        : <a key={start} className={className} href={url.href} target="_blank" rel="noopener noreferrer">{candidate}</a>);
      content.push(match[0].slice(candidate.length));
    } else {
      content.push(match[0]);
    }
    end = start + match[0].length;
  }
  content.push(text.slice(end));
  return <>{content.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</>;
}

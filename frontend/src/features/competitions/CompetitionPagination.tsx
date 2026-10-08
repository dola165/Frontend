import { useTranslation } from 'react-i18next';

/** Size changes are one command: the caller changes size and resets the URL page atomically. */
export function CompetitionPagination({ busy = false, page, totalPages, pageSize, sizes = [8,12,20,24], onPageChange, onPageSizeChange }: {
  busy?: boolean; page: number; totalPages: number; pageSize: number; sizes?: number[];
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void;
}) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  return <nav className="mc-pagination" aria-label={copy('Competition pages','შეჯიბრებების გვერდები')}>
    <button type="button" aria-disabled={busy || page===0} onClick={()=>{if(!busy && page>0)onPageChange(page-1);}}>{copy('Previous','წინა')}</button>
    <span>{copy(`Page ${page+1} of ${totalPages}`,`გვერდი ${page+1} / ${totalPages}`)}</span>
    <button type="button" aria-disabled={busy || page+1>=totalPages} onClick={()=>{if(!busy && page+1<totalPages)onPageChange(page+1);}}>{copy('Next','შემდეგი')}</button>
    <label>{copy('Show','ჩვენება')}<select aria-label={copy('Results per page','შედეგები გვერდზე')} value={pageSize} onChange={e=>onPageSizeChange(Number(e.target.value))}>{sizes.map(size=><option key={size} value={size}>{size}</option>)}</select></label>
  </nav>;
}

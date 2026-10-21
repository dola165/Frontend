import {expect,it} from 'vitest';
import {buildClubEnquiry,parseClubEnquiry} from './enquiryMessage';
it('sends an understandable first-visit message with the selected player, coach, venue and linked programme',()=>{
 const text=buildClubEnquiry({reason:'Arrange a first visit',programme:'U12 development',club:'Dinamo',path:'/clubs/1?tab=teams&programme=22',player:'Dol Dolsi',contact:'Coach Luka',venue:'Training ground · 12 Park Street',note:''});
 const card=parseClubEnquiry(text);expect(card?.path).toBe('/clubs/1?tab=teams&programme=22');expect(card?.body).toContain('Hello Coach Luka');expect(card?.body).toContain('my child, Dol Dolsi');expect(card?.body).toContain('12 Park Street');
});
it('uses myself for a self card and keeps additional questions intact',()=>{
 const text=buildClubEnquiry({reason:'Ask a question',programme:'Adults',club:'Dinamo',path:'/clubs/1?tab=teams&squad=2',player:'Ana',self:true,note:'Is Tuesday available?'});
 expect(parseClubEnquiry(text)?.body).toContain('myself (Ana)');expect(parseClubEnquiry(text)?.body).toContain('Is Tuesday available?');expect(text).not.toContain('my child');
});

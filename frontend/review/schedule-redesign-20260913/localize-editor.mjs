import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const path = 'src/components/schedule/EventCreationModal.tsx';
let source = readFileSync(path, 'utf8');
const rows = [
['plan','Plan','გეგმა'],
['whenWhere','When & where','დრო და ადგილი'],
['reviewShare','Review & share','გადამოწმება და გაზიარება'],
['chooseDate','Choose a date','აირჩიეთ თარიღი'],
['onlyYou','Only you','მხოლოდ თქვენ'],
['public','Public','საჯარო','schedule.event.public'],
['publishesLater','Publishes later','მოგვიანებით გამოქვეყნდება'],
['clubMembers','Club members','კლუბის წევრები'],
['chooseKind','Choose the kind of event you are planning.','აირჩიეთ ღონისძიების ტიპი.'],
['noTrainingDays','There are no training days in this date range. Choose a matching weekday or extend the end date.','ამ თარიღებს შორის ვარჯიშის დღეები არ არის. აირჩიეთ შესაბამისი კვირის დღე ან გადაწიეთ დასრულების თარიღი.'],
['futurePublication','Choose a publication time in the future.','აირჩიეთ გამოქვეყნების მომავალი დრო.'],
['publishBeforeEnd','Publish before the event ends. For weekly training, publish before the first day of the plan ends.','გამოაქვეყნეთ ღონისძიების დასრულებამდე. ყოველკვირეული ვარჯიშის შემთხვევაში, გამოაქვეყნეთ გეგმის პირველი დღის დასრულებამდე.'],
['seriesCancelled','Training series cancelled','ვარჯიშების სერია გაუქმდა'],
['eventCancelled','Event cancelled','ღონისძიება გაუქმდა'],
['cancelFailed','Could not cancel this event.','ღონისძიების გაუქმება ვერ მოხერხდა.'],
['trainingSeries','Training series','ვარჯიშების სერია'],
['editSeries','Edit training series','ვარჯიშების სერიის რედაქტირება'],
['editEvent','Edit event','ღონისძიების რედაქტირება'],
['newTraining','New weekly training','ახალი ყოველკვირეული ვარჯიში'],
['newEvent','New event','ახალი ღონისძიება'],
['saveChanges','Save changes','ცვლილებების შენახვა'],
['createTraining','Create training schedule','ვარჯიშის განრიგის შექმნა'],
['createEvent','Create event','ღონისძიების შექმნა'],
['mySchedule','My schedule','ჩემი განრიგი'],
['planYourTime','Plan your time','დაგეგმეთ თქვენი დრო'],
['weeklyIntro','Set your training rhythm once. Each session appears on the calendar.','ერთხელ შეადგინეთ ვარჯიშის განრიგი. თითოეული ვარჯიში კალენდარში გამოჩნდება.'],
['singleIntro','A clear plan, in a few simple steps.','მარტივად შეადგინეთ გეგმა რამდენიმე ნაბიჯში.'],
['closeEditor','Close event editor','ღონისძიების რედაქტორის დახურვა'],
['editorSteps','Event editor steps','ღონისძიების შექმნის ნაბიჯები'],
['whatPlanning','What are you planning?','რას გეგმავთ?'],
['weeklyRhythm','Build your weekly rhythm','შეადგინეთ ყოველკვირეული განრიგი'],
['setTimePlace','Set the time and place','მიუთითეთ დრო და ადგილი'],
['readyForCalendar','Ready for your calendar','მზადაა კალენდრისთვის'],
['planHint','Choose once, then add just the details you need.','აირჩიეთ ტიპი და დაამატეთ საჭირო დეტალები.'],
['weeklyHint','Pick training days, a time and the dates this routine runs.','აირჩიეთ ვარჯიშის დღეები, დრო და განრიგის მოქმედების პერიოდი.'],
['singleTimeHint','Choose when it happens. A venue is optional.','მიუთითეთ ღონისძიების დრო. ადგილის მითითება არასავალდებულოა.'],
['reviewHint','Check the plan and choose who can see it.','გადაამოწმეთ გეგმა და აირჩიეთ, ვინ ნახავს მას.'],
['scheduleType','Schedule type','განრიგის ტიპი'],
['oneTime','One-time event','ერთჯერადი ღონისძიება'],
['oneTimeHint','A match, session, tryout or activity on a specific date.','მატჩი, ვარჯიში, შერჩევა ან სხვა ღონისძიება კონკრეტულ დღეს.'],
['weeklyTraining','Weekly training','ყოველკვირეული ვარჯიში'],
['weeklyChoiceHint','A regular routine on the weekdays you choose.','რეგულარული ვარჯიში თქვენ მიერ არჩეულ კვირის დღეებში.'],
['eventType','Event type','ღონისძიების ტიპი'],
['everyWeek','every week','ყოველ კვირას'],
['trainingName','Training name','ვარჯიშის დასახელება'],
['eventName','Event name','ღონისძიების დასახელება'],
['trainingNamePlaceholder','e.g. U16 evening training','მაგ. U16-ის საღამოს ვარჯიში'],
['eventNamePlaceholder','e.g. Home match vs City FC','მაგ. საშინაო მატჩი City FC-სთან'],
['squad','Squad','გუნდი'],
['optional','Optional','არასავალდებულო'],
['noSquad','No squad assigned','გუნდი არ არის მითითებული'],
['currentSquad','Current squad','მიმდინარე გუნდი'],
['squadsFailed','Squads could not load. Your current assignment is preserved.','გუნდების ჩატვირთვა ვერ მოხერხდა. თქვენი მიმდინარე არჩევანი შენარჩუნებულია.'],
['notesHeading','Notes for the event','შენიშვნები ღონისძიებისთვის'],
['eventNotes','Event notes','ღონისძიების შენიშვნები'],
['notesPlaceholder','What to bring, where to meet, or the plan for the session.','რა უნდა იქონიოთ თან, სად შეიკრიბოთ ან რა არის დაგეგმილი.'],
['trainingDays','Training days','ვარჯიშის დღეები'],
['date','Date','თარიღი','schedule.event.date'],
['starts','Starts','დაწყება'],
['startTime','Start time','დაწყების დრო'],
['ends','Ends','დასრულება'],
['endTime','End time','დასრულების დრო'],
['duration','Duration','ხანგრძლივობა'],
['oneHour','1 hour','1 საათი'],
['oneHalfHours','1½ hours','1½ საათი'],
['twoHours','2 hours','2 საათი'],
['startsFrom','Starts from','იწყება'],
['trainingStartDate','Training start date','ვარჯიშის დაწყების თარიღი'],
['chooseDaysDates','choose your days and dates','აირჩიეთ დღეები და თარიღები'],
['endsOn','Ends on','მთავრდება'],
['trainingEndDate','Training end date','ვარჯიშის დასრულების თარიღი'],
['ongoingHint','Leave empty for an ongoing routine.','უვადო განრიგისთვის დატოვეთ ცარიელი.'],
['location','Location','მდებარეობა','schedule.event.location'],
['locationPlaceholder','e.g. Training ground, pitch 2','მაგ. სავარჯიშო მოედანი 2'],
['hideMap','Hide map','რუკის დამალვა'],
['changeMapLocation','Change map location','მდებარეობის შეცვლა რუკაზე'],
['chooseMapLocation','Choose location on map','მდებარეობის არჩევა რუკაზე'],
['removePin','Remove pin','ნიშნულის წაშლა'],
['chooseVenue','Choose a venue','აირჩიეთ ადგილი'],
['what','What','რა'],
['addEventName','Add an event name','დაამატეთ ღონისძიების დასახელება'],
['when','When','როდის'],
['chooseWeekdays','Choose weekdays','აირჩიეთ კვირის დღეები'],
['chooseTimes','Choose start and end times','აირჩიეთ დაწყებისა და დასრულების დრო'],
['dates','Dates','თარიღები'],
['noEndDate',' · no end date',' · დასრულების თარიღის გარეშე'],
['where','Where','სად'],
['noLocation','No location added','ადგილი არ არის მითითებული'],
['whoCanSee','Who can see this?','ვინ ნახავს?','schedule.event.whoCanSee'],
['eventVisibility','Event visibility','ღონისძიების ხილვადობა'],
['clubVisibilityHint','Keep it inside your club.','ხელმისაწვდომია მხოლოდ თქვენი კლუბისთვის.'],
['publicVisibilityHint','Visible beyond your club.','ხილულია კლუბის გარეთაც.'],
['publishLater','Publish automatically later','მოგვიანებით ავტომატურად გამოქვეყნება'],
['choosePublication','Choose a publication date','აირჩიეთ გამოქვეყნების თარიღი'],
['publishOn','Publish on','გამოქვეყნების თარიღი','schedule.event.publishOn'],
['publicationHint','Club members can see it now. It becomes public at this time.','კლუბის წევრებს უკვე შეუძლიათ ნახვა. მითითებულ დროს საჯარო გახდება.'],
['squadVisibilityHint','Squad assignment helps organise the calendar. Club members can still see club-only events.','გუნდის მითითება კალენდრის ორგანიზებაში დაგეხმარებათ. კლუბის წევრები კვლავ ხედავენ კლუბის შიდა ღონისძიებებს.'],
['privateTitle','Only you can see this','მხოლოდ თქვენ შეგიძლიათ ნახვა'],
['privateHint','Personal plans stay private, even when you belong to a club.','პირადი გეგმები მხოლოდ თქვენთვის რჩება, მაშინაც, როცა კლუბის წევრი ხართ.'],
['schedulePreview','Schedule preview','განრიგის წინასწარი ხედი'],
['onSchedule','ON YOUR SCHEDULE','თქვენს განრიგში'],
['livePreview','Live preview','ცოცხალი წინასწარი ხედი'],
['yourEvent','Your event','თქვენი ღონისძიება'],
['yourTraining','Your weekly training','თქვენი ყოველკვირეული ვარჯიში'],
['yourNextEvent','Your next event','თქვენი შემდეგი ღონისძიება'],
['chooseTrainingDays','Choose training days','აირჩიეთ ვარჯიშის დღეები'],
['chooseTime','Choose a time','აირჩიეთ დრო'],
['locationToAdd','Location to be added','ადგილი დასამატებელია'],
['repeatsWeekly','Repeats weekly','მეორდება ყოველ კვირას'],
['firstSessions','First sessions','პირველი ვარჯიშები'],
['firstSessionsHint','Choose weekdays and a date range to see your first sessions.','პირველი ვარჯიშების სანახავად აირჩიეთ კვირის დღეები და პერიოდი.'],
['savedSeriesDetails','These are the saved details of your training series.','ეს თქვენი ვარჯიშების სერიის შენახული დეტალებია.'],
['notSavedYet','Nothing is added to the calendar until you save.','შენახვამდე კალენდარში არაფერი დაემატება.'],
['saveWholeSeries','Saving updates the entire training series.','შენახვა ვარჯიშების მთელ სერიას განაახლებს.'],
['appearsWhenSaved','Your plan will appear on the calendar when you save.','შენახვის შემდეგ თქვენი გეგმა კალენდარში გამოჩნდება.'],
['seriesReadOnly','This series is read-only.','ამ სერიის მხოლოდ ნახვაა შესაძლებელი.'],
['wholeSeries','Applies to the whole series','ვრცელდება მთელ სერიაზე'],
['routineFooter','One routine. Every session on your calendar.','ერთი განრიგი. ყველა ვარჯიში თქვენს კალენდარში.'],
['savingPrivate','Saving to your private schedule','ინახება თქვენს პირად განრიგში'],
['cancelSeries','Cancel series','სერიის გაუქმება'],
['cancelEvent','Cancel event','ღონისძიების გაუქმება'],
['close','Close','დახურვა'],
['cancel','Cancel','გაუქმება','schedule.event.cancel'],
['back','Back','უკან','schedule.event.back'],
['continue','Continue','გაგრძელება','schedule.event.continue'],
['saving','Saving…','ინახება…'],
['keepEditing','Keep editing','რედაქტირების გაგრძელება'],
['cancelSeriesTitle','Cancel this training series?','გსურთ ვარჯიშების ამ სერიის გაუქმება?'],
['cancelEventTitle','Cancel this event?','გსურთ ამ ღონისძიების გაუქმება?'],
['cancelSeriesMessage','This cancels the whole training series, not just the selected session.','გაუქმდება ვარჯიშების მთელი სერია და არა მხოლოდ არჩეული ვარჯიში.'],
['cancelEventMessage','This event will be marked as cancelled.','ეს ღონისძიება გაუქმებულად მოინიშნება.'],
['keepEvent','Keep event','ღონისძიების შენარჩუნება'],
['startedSeriesNotice','<strong>This training series has already started.</strong> Its saved dates are shown below. Editing an active series is not supported yet; its history will be kept intact.','<strong>ვარჯიშების ეს სერია უკვე დაწყებულია.</strong> შენახული თარიღები ქვემოთაა ნაჩვენები. დაწყებული სერიის რედაქტირება ჯერ არ არის ხელმისაწვდომი; მისი ისტორია უცვლელად შენარჩუნდება.'],
['wholeSeriesNotice','Changes apply to the <strong>whole training series</strong>, including every selected weekday.','ცვლილებები გავრცელდება <strong>ვარჯიშების მთელ სერიაზე</strong>, ყველა არჩეული კვირის დღის ჩათვლით.'],
['trainingRepeats','Training repeats {{cadence}}. Pick the days in the next step.','ვარჯიში მეორდება {{cadence}}. დღეები აირჩიეთ შემდეგ ეტაპზე.'],
['everyWeeks','every {{interval}} weeks','ყოველ {{interval}} კვირაში'],
['everyWeeksCapital','Every {{interval}} weeks','ყოველ {{interval}} კვირაში'],
['minutesShort','{{minutes}} min','{{minutes}} წთ'],
['minutesLong','{{minutes}} minutes','{{minutes}} წუთი'],
['firstSession','First session: {{date}}','პირველი ვარჯიში: {{date}}'],
['timesEntered','Times are shown as entered{{timezone}}.','დრო ნაჩვენებია შეყვანილი მნიშვნელობებით{{timezone}}.'],
['savingTo','Saving to {{club}}','ინახება კლუბის განრიგში: {{club}}'],
];
const translations = new Map(rows.map(([key,en,ka,reuse]) => [en, {key:reuse ?? `schedule.editor.${key}`,en,ka}]));
const replace = (before, after) => {
 if (!source.includes(before)) throw new Error('Missing anchor: '+before.slice(0,100));
 source = source.replace(before, after);
};
source = source.replaceAll('\r\n','\n');
replace("import { useTranslation } from 'react-i18next';", "import { Trans, useTranslation } from 'react-i18next';");
replace("const STEPS = ['Plan', 'When & where', 'Review & share'];\n", '');
const dateStart = source.indexOf('const readableDate = (date: string) =>');
const dateEnd = source.indexOf('type Issue = ', dateStart);
const dateHelper = source.slice(dateStart,dateEnd).replace("new Intl.DateTimeFormat('en-GB',", 'new Intl.DateTimeFormat(dateLocale,');
source = source.slice(0,dateStart)+source.slice(dateEnd);
replace('    const { t } = useTranslation();', `    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage || i18n.language || 'en';
    const dateLocale = language.startsWith('en') ? 'en-GB' : language;
    const STEPS = ['Plan', 'When & where', 'Review & share'];
    const days = DAYS.map((day, index) => ({
        ...day,
        short: new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(2024, 0, index + 1, 12)),
        label: new Intl.DateTimeFormat(dateLocale, { weekday: 'long' }).format(new Date(2024, 0, index + 1, 12)),
    }));
    ${dateHelper.trim().replaceAll('\n','\n    ')}`);
replace('const daysText = DAYS.filter(', 'const daysText = days.filter(');
replace('{DAYS.map((day, index) => (', '{days.map((day, index) => (');
// Preserve emphasis while allowing translated sentences to use their own word order.
source = source.replace(/<strong>This training series has already started\.<\/strong> Its saved dates are shown\s+below\. Editing an active series is not supported yet; its history will be kept intact\./,
    '<Trans i18nKey="schedule.editor.startedSeriesNotice" components={{ strong: <strong /> }} />');
source = source.replace(/Changes apply to the <strong>whole training series<\/strong>, including every selected\s+weekday\./,
    '<Trans i18nKey="schedule.editor.wholeSeriesNotice" components={{ strong: <strong /> }} />');
source = source.replace(/Training repeats\{' '\}\s+\{interval === 1 \? 'every week' : `every \$\{interval\} weeks`\}\. Pick\s+the days in the next step\./,
    "{t('schedule.editor.trainingRepeats', { cadence: interval === 1 ? 'every week' : t('schedule.editor.everyWeeks', { interval }) })}");
source = source.replace(/First session:\{' '\}\s+\{sessionDates\[0\]\s+\? readableDate\(sessionDates\[0\]\)\s+: 'choose your days and dates'\}/,
    "{t('schedule.editor.firstSession', { date: sessionDates[0] ? readableDate(sessionDates[0]) : 'choose your days and dates' })}");
source = source.replace(/Times are shown as entered\s+\{recurring && form\.recurrenceTimezone\s+\? ` · \$\{form\.recurrenceTimezone\.replaceAll\('_', ' '\)\}`\s+: ''\}\s+\./,
    "{t('schedule.editor.timesEntered', { timezone: recurring && form.recurrenceTimezone ? ` · ${form.recurrenceTimezone.replaceAll('_', ' ')}` : '' })}");
replace('`${duration} min`', "t('schedule.editor.minutesShort', { minutes: duration })");
replace('`every ${interval} weeks`', "t('schedule.editor.everyWeeks', { interval })");
replace('`Every ${interval} weeks`', "t('schedule.editor.everyWeeksCapital', { interval })");
replace('` · ${minutes} minutes`', "` · ${t('schedule.editor.minutesLong', { minutes })}`");
replace('<small>{minutes} min</small>', "<small>{t('schedule.editor.minutesShort', { minutes })}</small>");
replace('`Saving to ${subjectLabel}`', "t('schedule.editor.savingTo', { club: subjectLabel })");
replace("eventType ? eventTypeCopy[eventType].label : 'Your event'", "eventType ? t(`schedule.event.${eventType.toLowerCase()}`) : 'Your event'");
// Replace only registered display copy: strings in logic/attributes and JSX text.
const tree = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const edits = [];
function visit(node) {
 if (ts.isStringLiteral(node)) {
   const match = translations.get(node.text);
   if (match) edits.push({start:node.getStart(tree),end:node.end,text:ts.isJsxAttribute(node.parent)?`{t('${match.key}')}`:`t('${match.key}')`});
 } else if (ts.isJsxText(node)) {
   const raw = node.getText(tree), normalized = raw.replace(/\s+/g,' ').trim(), match = translations.get(normalized);
   if (match) edits.push({start:node.getStart(tree),end:node.end,text:`${raw.match(/^\s*/)?.[0]??''}{t('${match.key}')}${raw.match(/\s*$/)?.[0]??''}`});
 }
 ts.forEachChild(node,visit);
}
visit(tree);
for (const edit of edits.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
writeFileSync(path,source);
for (const lang of ['en','ka']) {
 const localePath=`src/locales/${lang}.ts`;
 let locale=readFileSync(localePath,'utf8');
 if(locale.includes('    editor: {')) throw new Error('Existing editor block requires review');
 const lines=rows.filter(row=>!row[3]).map(([key,en,ka])=>`      ${key}: ${JSON.stringify(lang==='en'?en:ka)},`).join('\n');
 const anchor='  schedule: {';
 if(!locale.includes(anchor))throw new Error('Missing schedule locale');
 locale=locale.replace(anchor,`${anchor}\n    editor: {\n${lines}\n    },`);
 writeFileSync(localePath,locale);
}
console.log(`Localized ${edits.length} literal/text occurrences with ${rows.filter(row=>!row[3]).length} editor keys.`);

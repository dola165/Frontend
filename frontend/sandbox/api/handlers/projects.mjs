// A club's projects (step 4), on /clubs/:id/projects, with the rules of ProjectAccess: the owner, admins, the
// commercial lead and the facilities coordinator see every project; anyone else only the ones they are on.
// Personas (cookie gk-sandbox-persona): commercial (Irakli), facilities (Levan), projectcoach (Luka as a head coach
// on one project's step, not an admin) and kitparent (Nana, a U12 parent on the kit committee), all at Dinamo. None:
// Luka, an admin at Dinamo and at Gldani Juniors (not verified). Fundraisers move and go public as CampaignService does.
import { del, get, patch, post, put, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as J from '../world-projects.mjs';
import * as F from '../world-football.mjs';
import './project-personas.mjs';

const problem = (status, message) => reply(status, { status, message });
const missing = () => problem(404, 'This project is not here.');
const conflict = what => problem(409, `Someone else changed this ${what} after you opened it. Reload to see their change, then try again.`);

const ACTING = { commercial: J.irakli.id, facilities: J.levan.id, kitparent: J.nana.id };
const me = headers => ACTING[V.personaOf(headers)] ?? V.viewerId(headers);
const admin = headers => !V.isNewcomer(headers) && !V.restrictedPersona(headers);
// Luka is an admin at both clubs; the personas work at Dinamo only.
const atClub = (headers, clubId) => admin(headers) ? J.CLUBS.includes(Number(clubId)) : Number(clubId) === J.CLUB_ID;
const everyProject = (headers, clubId) => atClub(headers, clubId) && (admin(headers) || ['commercial', 'facilities'].includes(V.personaOf(headers)));
const publishes = (headers, clubId) => atClub(headers, clubId) && (admin(headers) || V.personaOf(headers) === 'commercial');
const onStaff = (headers, clubId) => !V.isNewcomer(headers) && V.personaOf(headers) !== 'kitparent' && atClub(headers, clubId);
const isOn = (project, id) => project.createdBy === id || project.added.includes(id) || project.steps.some(step => step.personId === id);
const sees = (project, headers) => everyProject(headers, project.clubId) || isOn(project, me(headers));
const changes = (project, headers) => everyProject(headers, project.clubId) || (project.createdBy === me(headers) && onStaff(headers, project.clubId));
const verified = clubId => Boolean(W.clubById(clubId)?.verified);
const LIVE = ['PUBLISHED', 'PAUSED'];
// CampaignService.move: a draft is published; a published one paused or closed; a paused one published again or closed.
const MOVES = { DRAFT: ['PUBLISHED'], PUBLISHED: ['PAUSED', 'CLOSED'], PAUSED: ['PUBLISHED', 'CLOSED'] };
const blank = value => !String(value ?? '').trim();
const GOFUNDME = /^https:\/\/([a-z0-9-]+\.)*gofundme\.com(\/\S*)?$/i;

const person = id => { const p = W.personById(id); return p ? { id: p.id, name: p.fullName, avatarUrl: p.avatarUrl ?? null } : null; };
const squad = id => { const s = W.squadById(id); return s ? { id: s.id, name: s.name } : null; };
const club = clubId => { const c = W.clubById(clubId); return { id: c.id, name: c.name, crestUrl: c.logoUrl ?? null }; };
// What a project or step can be given to: the club's squads and the people on its staff.
const choices = clubId => ({ squads: W.squads.filter(s => s.clubId === Number(clubId)).map(s => ({ id: s.id, name: s.name })),
    people: [W.me, ...(Number(clubId) === J.CLUB_ID ? [J.irakli, J.levan, J.giorgi] : []), ...W.staff.filter(s => s.clubId === Number(clubId) && s.personId !== W.ME_ID).slice(0, 6).map(s => W.personById(s.personId))].filter(Boolean).map(p => person(p.id)) });
const people = project => [...new Set([project.createdBy, ...project.added, ...project.steps.map(step => step.personId).filter(Boolean)])].map(person).filter(Boolean);

function summary(project, headers) {
    const done = project.steps.filter(step => step.done).length;
    const raised = project.fundraiser?.reportedAmount ?? null;
    const fromMoney = project.target != null;
    const progress = fromMoney ? Math.min(100, Math.floor((raised ?? 0) * 100 / project.target.amount))
        : project.status === 'DONE' ? 100 : project.steps.length ? Math.floor(done * 100 / project.steps.length) : 0;
    return {
        id: project.id, goal: project.goal, status: project.status, squad: squad(project.squadId), dueOn: project.dueOn, target: project.target, raised,
        progress, progressFromMoney: fromMoney, stepsDone: done, stepsTotal: project.steps.length, nextStep: project.steps.find(step => !step.done)?.title ?? null,
        people: people(project), waitingOnMe: project.steps.filter(step => !step.done && step.personId === me(headers)).length,
        fundraiserStatus: project.fundraiser?.status ?? null, updatedAt: project.updatedAt,
    };
}

function detail(project, headers) {
    const viewer = me(headers), runs = changes(project, headers);
    const f = project.fundraiser;
    return {
        summary: summary(project, headers), purpose: project.purpose, version: project.version, startedBy: person(project.createdBy),
        steps: project.steps.map(step => ({ id: step.id, title: step.title, done: step.done, person: person(step.personId), day: step.day, mine: step.personId === viewer, canChange: runs || step.personId === viewer, version: step.version })),
        talk: project.talk.map(c => ({ id: c.id, author: person(c.authorId), body: c.body, createdAt: c.createdAt, editedAt: c.editedAt, canEdit: c.authorId === viewer || admin(headers) })),
        files: project.files.map(file => ({ ...file, uploadedBy: person(file.uploadedBy), canDelete: file.uploadedBy === viewer || runs })),
        history: project.history.map(line => ({ at: line.at, by: person(line.by), byDola: false, text: line.text })),
        fundraiser: f && { id: f.id, status: f.status, phase: f.phase, donateUrl: f.donateUrl, goal: project.target, reportedAmount: f.reportedAmount, reportedNote: f.reportedNote,
            reportedBy: person(f.reportedBy), reportedAt: f.reportedAt, publishedBy: person(f.publishedBy), publishedAt: f.publishedAt, clubVerified: verified(project.clubId),
            publicNow: verified(project.clubId) && ['PUBLISHED', 'PAUSED', 'CLOSED'].includes(f.status), version: f.version,
            currency: f.currency, summary: f.summary, description: f.description, beneficiary: f.beneficiary, useOfFunds: f.useOfFunds, category: f.category,
            startsOn: f.startsOn, endsOn: f.endsOn, images: f.images ?? [] },
        can: { change: runs, addPeople: runs, talk: true, startFundraiser: runs && !f, publish: publishes(headers, project.clubId) && Boolean(f) },
        club: club(project.clubId), choices: runs ? choices(project.clubId) : null,
    };
}

const find = (params, headers) => {
    const project = J.projects.find(p => p.id === Number(params.pid) && (params.id == null || p.clubId === Number(params.id)));
    return project && sees(project, headers) ? project : null;
};
const touched = (project, headers, text) => { project.updatedAt = new Date().toISOString(); if (text) project.history.unshift({ at: project.updatedAt, by: me(headers), text }); };

get('/clubs/:id/projects', ({ params, headers }) => {
    const clubId = Number(params.id);
    if (!W.clubById(clubId)) return missing();
    const mine = J.projects.filter(project => project.clubId === clubId && sees(project, headers));
    if (!mine.length && !onStaff(headers, clubId)) return missing();
    const viewer = me(headers);
    const needsYou = mine.filter(p => p.status !== 'DONE').flatMap(p => p.steps.filter(step => !step.done && step.personId === viewer)
        .map(step => ({ projectId: p.id, project: p.goal, stepId: step.id, step: step.title, day: step.day })));
    return { club: club(clubId), needsYou, projects: mine.map(project => summary(project, headers)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), canStart: onStaff(headers, clubId), choices: onStaff(headers, clubId) ? choices(clubId) : null };
});

// The doors across clubs: the clubs where the person has projects, a project by id alone, a fundraiser's project.
get('/projects/mine', ({ headers }) => {
    const viewer = me(headers);
    return J.CLUBS.flatMap(clubId => {
        const mine = J.projects.filter(project => project.clubId === clubId && sees(project, headers));
        if (!mine.length && !onStaff(headers, clubId)) return [];
        return [{ club: club(clubId), open: mine.filter(p => p.status === 'NOW' || p.status === 'LATER').length,
            waitingOnMe: mine.filter(p => p.status !== 'DONE').flatMap(p => p.steps).filter(step => !step.done && step.personId === viewer).length, canStart: onStaff(headers, clubId) }];
    }).sort((a, b) => b.waitingOnMe - a.waitingOnMe);
});
get('/projects/fundraisers/:cid', ({ params, headers }) => {
    const project = J.projects.find(p => p.fundraiser?.id === Number(params.cid));
    return project && sees(project, headers) ? { clubId: project.clubId, projectId: project.id } : missing();
});
get('/projects/:pid', ({ params, headers }) => { const project = find({ pid: params.pid }, headers); return project ? detail(project, headers) : missing(); });

get('/clubs/:id/projects/:pid', ({ params, headers }) => { const project = find(params, headers); return project ? detail(project, headers) : missing(); });

const FIRST_STEPS = {
    RAISE_MONEY: [['Set the target', 'მიზნის თანხის დადგენა'], ['Start the fundraiser', 'შეგროვების დაწყება'], ['Thank the givers', 'შემომწირველებისთვის მადლობის თქმა']],
    BUY_SOMETHING: [['Get quotes', 'ფასების შეგროვება'], ['Choose one', 'არჩევა'], ['Pay', 'გადახდა'], ['Hand out', 'დარიგება']],
    FIND_SPONSOR: [['Contact the business', 'კომპანიასთან დაკავშირება'], ['Send an offer', 'შეთავაზების გაგზავნა'], ['Agree', 'შეთანხმება'], ['Add their logo to the club page', 'ლოგოს დამატება კლუბის გვერდზე']],
    FIX_OR_BUILD: [['Get quotes', 'ფასების შეგროვება'], ['Book the work', 'სამუშაოს დაჯავშნა'], ['Check it', 'შემოწმება']],
};

post('/clubs/:id/projects', ({ params, body, headers }) => {
    if (!onStaff(headers, params.id)) return missing();
    const goal = String(body?.goal ?? '').trim();
    if (!goal || goal.length > 120) return problem(400, 'Give the project a goal of up to 120 characters.');
    if (body?.status != null && !['NOW', 'LATER', 'IDEA'].includes(body.status)) return problem(400, 'A new project is for now, for later or an idea.');
    const titles = Array.isArray(body?.steps) && body.steps.length ? body.steps : (FIRST_STEPS[body?.kind] ?? []).map(([en, ka]) => body?.language === 'ka' ? ka : en);
    const project = { id: J.newId(), clubId: Number(params.id), goal, purpose: body?.purpose || null, status: body?.status ?? 'NOW', squadId: body?.squadId ?? null, dueOn: body?.dueOn ?? null, target: null,
        createdBy: me(headers), added: [], updatedAt: new Date().toISOString(), version: 0, steps: titles.map(title => ({ id: J.newId(), title, personId: null, done: false, day: null, version: 0 })),
        talk: [], files: [], history: [], fundraiser: null };
    J.projects.unshift(project);
    touched(project, headers, 'Started');
    return reply(201, detail(project, headers));
});

patch('/clubs/:id/projects/:pid', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects, or whoever started this one, change it.');
    if (body?.version !== project.version) return conflict('project');
    const before = JSON.stringify([project.goal, project.purpose, project.squadId, project.dueOn, project.target, project.status]);
    const goal = body.goal ? String(body.goal).trim() : project.goal;
    const target = body.clearTarget ? null : body.target ? { amount: Number(body.target.amount), currency: body.target.currency } : project.target;
    const f = project.fundraiser;
    // The goal and target are the fundraiser's title and goal: public ones are the publishers'; a reported amount keeps its currency.
    if (f && (goal !== project.goal || JSON.stringify(target) !== JSON.stringify(project.target))) {
        if (LIVE.includes(f.status) && !publishes(headers, project.clubId)) return problem(403, 'Its fundraiser is public: only an admin or the commercial lead changes the goal or the target now.');
        if (f.reportedAmount != null && target && target.currency !== f.currency) return problem(409, `The amount raised is reported in ${f.currency}. Update the amount raised in ${target.currency} first, then change the target's currency.`);
    }
    project.goal = goal;
    if (body.purpose !== undefined) project.purpose = body.purpose || null;
    if (body.clearSquad) project.squadId = null; else if (body.squadId) project.squadId = Number(body.squadId);
    if (body.clearDueOn) project.dueOn = null; else if (body.dueOn) project.dueOn = body.dueOn;
    project.target = target;
    if (body.status) project.status = body.status;
    if (JSON.stringify([project.goal, project.purpose, project.squadId, project.dueOn, project.target, project.status]) === before) return detail(project, headers);
    if (f) Object.assign(f, { title: project.goal, goalAmount: project.target?.amount ?? null, currency: project.target?.currency ?? f.currency });
    project.version += 1;
    touched(project, headers, body.status === 'DONE' ? 'Done' : 'Changed the project');
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/steps', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects add steps.');
    if (blank(body?.title)) return problem(400, 'Give the step a title.');
    project.steps.push({ id: J.newId(), title: String(body?.title ?? '').trim(), personId: body?.personId ?? null, done: false, day: body?.day ?? null, version: 0 });
    touched(project, headers);
    return reply(201, detail(project, headers));
});

patch('/clubs/:id/projects/:pid/steps/:sid', ({ params, body, headers }) => {
    const project = find(params, headers);
    const step = project?.steps.find(s => s.id === Number(params.sid));
    if (!step) return missing();
    const runs = changes(project, headers);
    if (!runs && step.personId !== me(headers)) return problem(403, 'Only the person this step waits on changes it.');
    if (body?.version !== step.version) return conflict('step');
    const reshapes = body.title != null || body.personId != null || body.clearPerson || body.day != null || body.clearDay;
    if (reshapes && !runs) return problem(403, 'You tick off your own step; whoever runs the project changes it.');
    if (body.title) step.title = String(body.title).trim();
    if (body.clearPerson) step.personId = null; else if (body.personId) step.personId = Number(body.personId);
    if (body.clearDay) step.day = null; else if (body.day) step.day = body.day;
    if (body.done != null) step.done = Boolean(body.done);
    step.version += 1;
    touched(project, headers, `${step.title}: ${body.done === true ? 'Done' : body.done === false ? 'Not done after all' : 'Changed'}`);
    return detail(project, headers);
});

del('/clubs/:id/projects/:pid/steps/:sid', ({ params, headers }) => {
    const project = find(params, headers);
    const index = project?.steps.findIndex(s => s.id === Number(params.sid)) ?? -1;
    if (index < 0) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects remove steps.');
    const [removed] = project.steps.splice(index, 1);
    touched(project, headers, `Removed the step ${removed.title}`);
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/talk', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (blank(body?.body)) return problem(400, 'Write something first.');
    project.talk.push({ id: J.newId(), authorId: me(headers), body: String(body?.body ?? '').trim(), createdAt: new Date().toISOString(), editedAt: null });
    touched(project, headers);
    return reply(201, detail(project, headers));
});

post('/clubs/:id/projects/:pid/paste', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects paste a plan.');
    const staff = [W.me, J.irakli, J.levan, J.nana, J.giorgi];
    const steps = String(body?.text ?? '').split('\n').map(line => line.trim().replace(/^[-*]\s+/, '')).filter(Boolean).map((line, index) => {
        const [title, ...fields] = line.split('|').map(part => part.trim());
        const name = fields.find(field => !/^ends\s/i.test(field));
        const found = name ? staff.find(p => p.fullName.toLowerCase() === name.toLowerCase() || p.firstName.toLowerCase() === name.toLowerCase()) : null;
        const ends = fields.find(field => /^ends\s+\d{4}-\d{2}-\d{2}$/i.test(field));
        return { line: index + 1, title: title.slice(0, 120), person: found ? person(found.id) : null, day: ends ? ends.slice(5).trim() : null,
            problem: name && !found ? `Nobody on the club's staff is called ${name}.` : null };
    });
    if (!body?.apply) return { steps, problems: [], project: null };
    for (const line of steps) project.steps.push({ id: J.newId(), title: line.title, personId: line.person?.id ?? null, done: false, day: line.day, version: 0 });
    touched(project, headers, `Pasted a plan: ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`);
    return { steps, problems: [], project: detail(project, headers) };
});

post('/clubs/:id/projects/:pid/fundraiser/amount', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project?.fundraiser) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects change its fundraiser.');
    if (body?.version !== project.fundraiser.version) return conflict('fundraiser');
    const f = project.fundraiser, currency = body.currency && body.currency !== f.currency ? body.currency : null;
    if (currency && LIVE.includes(f.status) && !publishes(headers, project.clubId)) return problem(403, 'This fundraiser is public: only an admin or the commercial lead changes it now.');
    if (currency) { f.currency = currency; if (project.target) project.target = { ...project.target, currency }; }
    Object.assign(f, { reportedAmount: Number(body.amount), reportedNote: body.note || 'Reported by the club', reportedBy: me(headers), reportedAt: new Date().toISOString(), version: f.version + 1 });
    touched(project, headers, currency ? `Updated the amount raised, now in ${currency}` : 'Updated the amount raised');
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/fundraiser/state', ({ params, body, headers }) => {
    const project = find(params, headers);
    const f = project?.fundraiser;
    if (!f) return missing();
    if (body?.status === 'PUBLISHED') {
        if (!publishes(headers, project.clubId)) return problem(403, 'An admin or the commercial lead publishes a fundraiser.');
        if (f.status === 'PUBLISHED') return detail(project, headers); // The first one counts.
        if (!verified(project.clubId)) return problem(409, 'A fundraiser goes public once the club is verified.');
    } else if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects change its fundraiser.');
    if (body?.version !== f.version) return conflict('fundraiser');
    if (!(MOVES[f.status] ?? []).includes(body.status)) return problem(409, 'This fundraiser can\'t move there from where it is now.');
    if (body.status === 'PUBLISHED' && !f.publishedAt) Object.assign(f, { publishedAt: new Date().toISOString(), publishedBy: me(headers) });
    Object.assign(f, { status: body.status, phase: body.status === 'PUBLISHED' ? 'ACTIVE' : body.status, version: f.version + 1 });
    touched(project, headers, body.status === 'PUBLISHED' ? 'Published the fundraiser' : body.status === 'PAUSED' ? 'Paused the fundraiser' : 'Closed the fundraiser');
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/fundraiser/updates', ({ params, body, headers }) => {
    const project = find(params, headers);
    const f = project?.fundraiser;
    if (!f) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects change its fundraiser.');
    if (body?.version !== f.version) return conflict('fundraiser');
    if (f.status !== 'PUBLISHED') return problem(409, 'Publish the campaign before posting an update.');
    if (blank(body?.title) || blank(body?.body)) return problem(400, 'An update needs a title and a few words.');
    f.updates = [{ id: J.newId(), title: String(body.title).trim(), body: String(body.body).trim(), createdAt: new Date().toISOString() }, ...(f.updates ?? [])];
    f.version += 1;
    touched(project, headers, `Posted a fundraiser update: ${String(body.title ?? '').trim()}`);
    return reply(201, detail(project, headers));
});

// The fundraiser's words and GoFundMe page, kept on its public record; the address follows the backend's one rule.
const WORDS = ['summary', 'description', 'beneficiary', 'useOfFunds', 'category', 'startsOn', 'endsOn', 'images'];
const fundraiserWords = (project, body) => {
    const link = body?.donateUrl?.trim();
    if (link && (link.length > 500 || !GOFUNDME.test(link) || /[\u0000-\u001f]/.test(link))) return 'Use the fundraiser\'s GoFundMe address as it shows in the browser, https://www.gofundme.com/f/…';
    if (body?.donateUrl !== undefined) project.fundraiser.donateUrl = link || null;
    for (const key of WORDS) if (body?.[key] !== undefined) project.fundraiser[key] = body[key];
    return null;
};
const newFundraiser = (project, headers) => {
    const c = W.clubById(project.clubId);
    const record = { id: J.newId(), clubId: project.clubId, clubName: c.name, clubLogoUrl: c.logoUrl ?? null, country: 'Georgia', city: c.city, title: project.goal,
        summary: '', description: '', beneficiary: '', useOfFunds: '', category: 'OTHER', currency: project.target?.currency ?? 'GEL', goalAmount: project.target?.amount ?? null,
        reportedAmount: null, reportedNote: '', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'DRAFT', phase: 'DRAFT', version: 0,
        updatedAt: new Date().toISOString(), publishedAt: null, updates: [], donateUrl: null, donations: 0, reportedBy: null, publishedBy: null, createdBy: me(headers) };
    F.campaigns.push(record);
    return record;
};
post('/clubs/:id/projects/:pid/fundraiser', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects start its fundraiser.');
    if (project.fundraiser) return problem(409, 'This project already has its fundraiser.');
    project.fundraiser = newFundraiser(project, headers);
    const wrong = fundraiserWords(project, body);
    if (wrong) { F.campaigns.splice(F.campaigns.indexOf(project.fundraiser), 1); project.fundraiser = null; return problem(400, wrong); }
    touched(project, headers, 'Started the fundraiser');
    return reply(201, detail(project, headers));
});
put('/clubs/:id/projects/:pid/fundraiser', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project?.fundraiser) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects change its fundraiser.');
    if (LIVE.includes(project.fundraiser.status) && !publishes(headers, project.clubId)) return problem(403, 'This fundraiser is public: only an admin or the commercial lead changes it now.');
    if (body?.version !== project.fundraiser.version) return conflict('fundraiser');
    const wrong = fundraiserWords(project, body);
    if (wrong) return problem(400, wrong);
    project.fundraiser.version += 1;
    touched(project, headers);
    return detail(project, headers);
});

// Photos and files are kept as invented addresses; the sandbox stores no bytes.
const addMedia = (kind, name) => ({ params, query, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    const id = J.newId();
    project.files.push({ id, kind, url: kind === 'IMAGE' ? `/sandbox-media/photo/upload-PROJECT-${id}.svg` : `/sandbox-media/file/upload-${id}.pdf`,
        name: kind === 'FILE' ? (query?.get?.('name') ?? name) : null, contentType: kind === 'IMAGE' ? 'image/jpeg' : 'application/pdf', sizeBytes: 140000, uploadedBy: me(headers), createdAt: new Date().toISOString() });
    touched(project, headers, kind === 'IMAGE' ? 'Added a photo' : 'Added a file');
    return reply(201, detail(project, headers));
};
post('/clubs/:id/projects/:pid/pictures', addMedia('IMAGE', null));
post('/clubs/:id/projects/:pid/files', addMedia('FILE', 'file.pdf'));
del('/clubs/:id/projects/:pid/files/:fid', ({ params, headers }) => {
    const project = find(params, headers);
    const index = project?.files.findIndex(file => file.id === Number(params.fid)) ?? -1;
    if (index < 0) return missing();
    if (project.files[index].uploadedBy !== me(headers) && !changes(project, headers)) return problem(403, 'Only the person who added a file, or whoever runs the project, removes it.');
    project.files.splice(index, 1);
    return detail(project, headers);
});
patch('/clubs/:id/projects/:pid/talk/:cid', ({ params, body, headers }) => {
    const project = find(params, headers);
    const comment = project?.talk.find(c => c.id === Number(params.cid));
    if (!comment) return missing();
    if (comment.authorId !== me(headers) && !admin(headers)) return problem(403, 'Only the author changes their message.');
    if (blank(body?.body)) return problem(400, 'Write something first.');
    Object.assign(comment, { body: String(body.body).trim(), editedAt: new Date().toISOString() });
    return detail(project, headers);
});
del('/clubs/:id/projects/:pid/talk/:cid', ({ params, headers }) => {
    const project = find(params, headers);
    const index = project?.talk.findIndex(c => c.id === Number(params.cid)) ?? -1;
    if (index < 0) return missing();
    if (project.talk[index].authorId !== me(headers) && !admin(headers)) return problem(403, 'Only the author changes their message.');
    project.talk.splice(index, 1);
    return detail(project, headers);
});
post('/clubs/:id/projects/:pid/people', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects add people.');
    if (!project.added.includes(Number(body?.userId))) project.added.push(Number(body?.userId));
    touched(project, headers, 'Added someone to the project');
    return detail(project, headers);
});
del('/clubs/:id/projects/:pid/people/:uid', ({ params, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects take people off.');
    project.added = project.added.filter(id => id !== Number(params.uid));
    return detail(project, headers);
});
put('/clubs/:id/projects/:pid/steps/order', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects order the steps.');
    const order = (body?.order ?? []).map(Number);
    project.steps.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return detail(project, headers);
});

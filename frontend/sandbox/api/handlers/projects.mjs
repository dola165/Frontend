// A club's projects (step 4), on /clubs/:id/projects, with the rules of ProjectAccess: the owner, admins, the
// commercial lead and the facilities coordinator see every project; anyone else only the ones they are on.
// Personas (cookie gk-sandbox-persona): commercial (Irakli), facilities (Levan), projectcoach (Luka as a head coach
// on one project's step, not an admin) and kitparent (Nana, a U12 parent on the kit committee). None: Luka, an admin.
import { del, get, patch, post, put, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as J from '../world-projects.mjs';

const problem = (status, message) => reply(status, { status, message });
const missing = () => problem(404, 'This project is not here.');
const conflict = what => problem(409, `Someone else changed this ${what} after you opened it. Reload to see their change, then try again.`);

const ACTING = { commercial: J.irakli.id, facilities: J.levan.id, kitparent: J.nana.id };
const me = headers => ACTING[V.personaOf(headers)] ?? V.viewerId(headers);
const admin = headers => !V.isNewcomer(headers) && !V.restrictedPersona(headers);
const everyProject = headers => admin(headers) || ['commercial', 'facilities'].includes(V.personaOf(headers));
const publishes = headers => admin(headers) || V.personaOf(headers) === 'commercial';
const onStaff = headers => !V.isNewcomer(headers) && V.personaOf(headers) !== 'kitparent';
const isOn = (project, id) => project.createdBy === id || project.added.includes(id) || project.steps.some(step => step.personId === id);
const sees = (project, headers) => everyProject(headers) || isOn(project, me(headers));
const changes = (project, headers) => everyProject(headers) || (project.createdBy === me(headers) && onStaff(headers));

const person = id => { const p = W.personById(id); return p ? { id: p.id, name: p.fullName, avatarUrl: p.avatarUrl ?? null } : null; };
const squad = id => { const s = W.squadById(id); return s ? { id: s.id, name: s.name } : null; };
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
            reportedBy: person(f.reportedBy), reportedAt: f.reportedAt, publishedBy: person(f.publishedBy), publishedAt: f.publishedAt, clubVerified: true,
            publicNow: ['PUBLISHED', 'PAUSED', 'CLOSED'].includes(f.status), version: f.version },
        can: { change: runs, addPeople: runs, talk: true, startFundraiser: runs && !f, publish: publishes(headers) && Boolean(f) },
    };
}

const find = (params, headers) => {
    const project = Number(params.id) === J.CLUB_ID ? J.projects.find(p => p.id === Number(params.pid)) : null;
    return project && sees(project, headers) ? project : null;
};
const touched = (project, headers, text) => { project.updatedAt = new Date().toISOString(); if (text) project.history.unshift({ at: project.updatedAt, by: me(headers), text }); };

get('/clubs/:id/projects', ({ params, headers }) => {
    if (Number(params.id) !== J.CLUB_ID) return onStaff(headers) ? { needsYou: [], projects: [], canStart: false } : missing();
    const mine = J.projects.filter(project => sees(project, headers));
    if (!mine.length && !onStaff(headers)) return missing();
    const viewer = me(headers);
    const needsYou = mine.filter(p => p.status !== 'DONE').flatMap(p => p.steps.filter(step => !step.done && step.personId === viewer)
        .map(step => ({ projectId: p.id, project: p.goal, stepId: step.id, step: step.title, day: step.day })));
    return { needsYou, projects: mine.map(project => summary(project, headers)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), canStart: onStaff(headers) };
});

get('/clubs/:id/projects/:pid', ({ params, headers }) => { const project = find(params, headers); return project ? detail(project, headers) : missing(); });

const FIRST_STEPS = {
    RAISE_MONEY: [['Set the target', 'მიზნის თანხის დადგენა'], ['Start the fundraiser', 'შეგროვების დაწყება'], ['Thank the givers', 'შემომწირველებისთვის მადლობის თქმა']],
    BUY_SOMETHING: [['Get quotes', 'ფასების შეგროვება'], ['Choose one', 'არჩევა'], ['Pay', 'გადახდა'], ['Hand out', 'დარიგება']],
    FIND_SPONSOR: [['Contact the business', 'კომპანიასთან დაკავშირება'], ['Send an offer', 'შეთავაზების გაგზავნა'], ['Agree', 'შეთანხმება'], ['Add their logo to the club page', 'ლოგოს დამატება კლუბის გვერდზე']],
    FIX_OR_BUILD: [['Get quotes', 'ფასების შეგროვება'], ['Book the work', 'სამუშაოს დაჯავშნა'], ['Check it', 'შემოწმება']],
};

post('/clubs/:id/projects', ({ params, body, headers }) => {
    if (Number(params.id) !== J.CLUB_ID || !onStaff(headers)) return missing();
    const goal = String(body?.goal ?? '').trim();
    if (!goal || goal.length > 120) return problem(400, 'Give the project a goal of up to 120 characters.');
    const titles = Array.isArray(body?.steps) && body.steps.length ? body.steps : (FIRST_STEPS[body?.kind] ?? []).map(([en, ka]) => body?.language === 'ka' ? ka : en);
    const project = { id: J.newId(), goal, purpose: body?.purpose || null, status: body?.status ?? 'NOW', squadId: body?.squadId ?? null, dueOn: body?.dueOn ?? null, target: null,
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
    if (body.goal) project.goal = String(body.goal).trim();
    if (body.purpose !== undefined) project.purpose = body.purpose || null;
    if (body.clearSquad) project.squadId = null; else if (body.squadId) project.squadId = Number(body.squadId);
    if (body.clearDueOn) project.dueOn = null; else if (body.dueOn) project.dueOn = body.dueOn;
    if (body.clearTarget) project.target = null; else if (body.target) project.target = { amount: Number(body.target.amount), currency: body.target.currency };
    if (body.status) project.status = body.status;
    project.version += 1;
    touched(project, headers, body.status === 'DONE' ? 'Done' : 'Changed the project');
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/steps', ({ params, body, headers }) => {
    const project = find(params, headers);
    if (!project) return missing();
    if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects add steps.');
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
    Object.assign(project.fundraiser, { reportedAmount: Number(body.amount), reportedNote: body.note || 'Reported by the club', reportedBy: me(headers), reportedAt: new Date().toISOString(), version: project.fundraiser.version + 1 });
    touched(project, headers, 'Updated the amount raised');
    return detail(project, headers);
});

post('/clubs/:id/projects/:pid/fundraiser/state', ({ params, body, headers }) => {
    const project = find(params, headers);
    const f = project?.fundraiser;
    if (!f) return missing();
    if (body?.status === 'PUBLISHED') {
        if (!publishes(headers)) return problem(403, 'An admin or the commercial lead publishes a fundraiser.');
        if (f.status === 'PUBLISHED') return detail(project, headers); // The first one counts.
    } else if (!changes(project, headers)) return problem(403, 'Only the people who run the club\'s projects change its fundraiser.');
    if (body?.version !== f.version) return conflict('fundraiser');
    if (body.status === 'PUBLISHED' && !f.publishedAt) Object.assign(f, { publishedAt: new Date().toISOString(), publishedBy: me(headers) });
    Object.assign(f, { status: body.status, phase: body.status === 'PUBLISHED' ? 'ACTIVE' : body.status, version: f.version + 1 });
    touched(project, headers, body.status === 'PUBLISHED' ? 'Published the fundraiser' : body.status === 'PAUSED' ? 'Paused the fundraiser' : 'Closed the fundraiser');
    return detail(project, headers);
});

// Files, people and the fundraiser's words answer as the real API does once phase B draws them.
put('/clubs/:id/projects/:pid/fundraiser', ({ params, headers }) => find(params, headers) ? problem(501, 'Not in the sandbox yet.') : missing());

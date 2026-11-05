// A fundraiser's photos upload here (CAMPAIGN context); everything else about a club's fundraiser is its project's
// (projects.mjs), as the backend has had since step 4 removed the old manager endpoints. B2 folds this into Projects.
import { post, reply } from '../router.mjs';
import * as C from '../world-club.mjs';

// Registered before the shared media stand-in. Other contexts continue through the existing handler.
post('/media/upload', ({ query }) => {
  if (query.get('context') !== 'CAMPAIGN') return undefined;
  const id = C.nextId(), url = `/sandbox-media/photo/upload-CAMPAIGN-${id}.svg`;
  return reply(201, { id, url, mediaId: id });
});

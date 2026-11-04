/** The answer to "Who's in it?": unanswered, "No children in it", or the children named. */
export interface PhotoAnswer { children: 'NONE' | 'NAMED' | null; people: number[] }
export const NOT_ANSWERED: PhotoAnswer = { children: null, people: [] };

/** What a post sends for the answer, nothing while unanswered (so earlier posts keep their shape). */
export const photoAnswerBody = (answer: PhotoAnswer) => answer.children ? { photoChildren: answer.children, ...(answer.children === 'NAMED' ? { photoPeople: answer.people } : {}) } : {};

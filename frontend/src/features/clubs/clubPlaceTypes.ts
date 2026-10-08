/** Missing legacy classifications remain visible without guessing what a place is. */
export const placeType = (place:{details:Record<string,string>}) => ['VENUE','FACILITY'].includes(place.details.placeType) ? place.details.placeType : 'UNCLASSIFIED';

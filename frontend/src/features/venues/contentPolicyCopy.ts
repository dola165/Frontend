export function venueContentPolicyCopy(language: string = 'en') {
  return language.startsWith('ka') ? {
    blocked: 'საჯარო გამოჩენა შეზღუდულია',
    notice: 'ამ სტადიონის საჯარო გვერდი და ონლაინ დაჯავშნა მიუწვდომელია. უფლებამოსილ გუნდს კვლავ შეუძლია ჯავშნების და მოედნების მართვა.',
    workspace: 'სტადიონის მართვა',
    explore: 'სტადიონების ნახვა',
  } : {
    blocked: 'Public promotion restricted',
    notice: 'This stadium’s public page and online booking are unavailable. The authorized team can still manage reservations and pitches.',
    workspace: 'Manage stadium',
    explore: 'Explore stadiums',
  };
}

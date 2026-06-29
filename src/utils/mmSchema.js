const ATHLETE_FIELDS = ['Ath_no','Last_name','First_name','Initial','Ath_Sex','Birth_date','Team_no','Schl_yr','Ath_age','Reg_no','Ath_stat','Div_no','Comp_no','Pref_name','Home_addr1','Home_addr2','Home_city','Home_prov','Home_statenew','Home_zip','Home_cntry','Home_daytele','Home_evetele','Home_faxtele','Home_email','Citizen_of','Picture_bmp','second_club','Home_celltele','bcssa_type']
const RESULT_FIELDS = ['Event_ptr','Ath_no','ActSeed_course','ActualSeed_time','ConvSeed_course','ConvSeed_time','Scr_stat','Spec_stat','Dec_stat','Alt_stat','Bonus_event','Div_no','Ev_score','JDEv_score','Seed_place','event_age','Pre_heat','Pre_lane','Pre_stat','Pre_Time','Pre_course','Pre_heatplace','Pre_place','Pre_jdplace','Pre_exh','Pre_points','Pre_back1','Pre_back2','Pre_back3','Pre_watch1','Pre_pad','Pre_reactiontime1','Pre_dqcode','Pre_dqcodeSecond','Pre_TimeType','Fin_heat','Fin_lane','Fin_stat','Fin_Time','Fin_course','Fin_heatplace','Fin_jdheatplace','Fin_place','Fin_jdplace','Fin_exh','Fin_points','Fin_back1','Fin_back2','Fin_back3','Fin_watch1','Fin_pad','Fin_reactiontime1','Fin_dqcode','Fin_dqcodeSecond','Fin_ptsplace','fin_heatltr','fin_TimeType','Sem_heat','Sem_lane','Sem_stat','Sem_Time','Sem_course','Sem_heatplace','Sem_place','Sem_jdplace','Sem_exh','Sem_points','Sem_back1','Sem_back2','Sem_back3','Sem_watch1','Sem_pad','Sem_reactiontime1','Sem_dqcode','Sem_dqcodeSecond','Sem_TimeType','dq_type','Fin_group','Fin_dolphin1','Fin_dolphin2','Fin_dolphin3','Pre_dolphin1','Pre_dolphin2','Pre_dolphin3','Sem_dolphin1','Sem_dolphin2','Sem_dolphin3']

const blankRecord = fields => Object.fromEntries(fields.map(field => [field, null]))
const NUMERIC_RESULT_FIELDS = new Set(['Div_no','Ev_score','JDEv_score','Seed_place','event_age','Pre_heat','Pre_lane','Pre_heatplace','Pre_place','Pre_jdplace','Pre_points','Fin_heat','Fin_lane','Fin_heatplace','Fin_jdheatplace','Fin_place','Fin_jdplace','Fin_points','Fin_ptsplace','Sem_heat','Sem_lane','Sem_heatplace','Sem_place','Sem_jdplace','Sem_points','Fin_group'])

export async function buildMMExport({ event, club, token, roster }) {
  const athletes = roster.map((athlete, index) => {
    const athNo = Number(club.code) * 1000 + index + 1
    return { ...blankRecord(ATHLETE_FIELDS), Ath_no: athNo, Last_name: athlete.lastName, First_name: athlete.firstName, Ath_Sex: athlete.sex, Birth_date: athlete.birthDate, Team_no: Number(club.code), Ath_age: athlete.age, Comp_no: athNo }
  })
  const results = roster.flatMap((athlete, index) => athlete.events.map(entry => ({ ...blankRecord(RESULT_FIELDS), Event_ptr: entry.eventIndex, Ath_no: Number(club.code) * 1000 + index + 1, ActSeed_course: 'S', ActualSeed_time: entry.time, ConvSeed_course: 'S', ConvSeed_time: entry.time })))
  const meta = { version: '1.0', system: 'SWIMTIMER Inscripciones by Scanleads', event_name: event.name, club_name: club.name, club_code: Number(club.code), generated_at: new Date().toISOString(), token, athlete_count: athletes.length, inscription_count: results.length }
  const content = JSON.stringify({ meta, athletes, results })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  meta.sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return { meta, athletes, results }
}

const sha256 = async value => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const normalizeAthlete = (athlete, late) => Object.fromEntries([...ATHLETE_FIELDS.map(field => {
  if (field === 'Div_no') return [field, Number(athlete[field] || 0)]
  return [field, athlete[field] ?? '']
}), ['late', late]])

const normalizeResult = (result, athlete) => Object.fromEntries(RESULT_FIELDS.map(field => {
  if (field === 'event_age') return [field, Number(athlete?.Ath_age || 0)]
  if (NUMERIC_RESULT_FIELDS.has(field)) return [field, Number(result[field] || 0)]
  return [field, result[field] ?? '']
}))

export async function buildConsolidatedExport({ event, inscriptions = [], lateInscriptions = [], type = 'principal' }) {
  const includeNormal = type !== 'supplement'
  const includeLate = type !== 'principal'
  const athletes = []
  const results = []
  const nextByTeam = new Map()
  const addSubmission = (submission, late) => {
    const approved = new Set(submission.approved_athletes || [])
    const selectedAthletes = submission.athletes.filter(athlete => !late || approved.has(athlete.Ath_no))
    const idMap = new Map()
    selectedAthletes.forEach(athlete => {
      const team = Number(athlete.Team_no)
      const currentMax = nextByTeam.get(team) || team * 1000
      const newId = late ? currentMax + 1 : Number(athlete.Ath_no)
      nextByTeam.set(team, Math.max(currentMax, newId))
      idMap.set(athlete.Ath_no, newId)
      athletes.push(normalizeAthlete({ ...athlete, Ath_no: newId, Comp_no: newId }, late))
    })
    submission.results.filter(result => idMap.has(result.Ath_no)).forEach(result => {
      const newId = idMap.get(result.Ath_no)
      results.push(normalizeResult({ ...result, Ath_no: newId }, athletes.find(athlete => athlete.Ath_no === newId)))
    })
  }
  if (includeNormal) inscriptions.forEach(item => addSubmission(item, false))
  if (includeLate) lateInscriptions.filter(item => ['approved','partially_approved'].includes(item.status)).forEach(item => addSubmission(item, true))
  const teamCodes = [...new Set(athletes.map(athlete => Number(athlete.Team_no)))]
  const teams = event.clubs.filter(club => teamCodes.includes(Number(club.code))).map(club => ({ Team_no: Number(club.code), Team_name: club.name, Team_short: club.short_name || club.name.slice(0, 16).toUpperCase(), Team_abbr: club.abbreviation || club.name.slice(0, 3).toUpperCase() }))
  const output = {
    meta: { version: '2.0', type, system: 'SWIMTIMER Inscripciones by Scanleads', event_name: event.name, event_date_start: event.date_start, event_date_end: event.date_end || event.date_start, event_venue: event.venue || '', generated_at: new Date().toISOString(), total_clubs: teams.length, total_athletes: athletes.length, total_inscriptions: results.length, sha256: '' },
    meet: { Meet_name1: event.name, Meet_start: event.date_start, Meet_end: event.date_end || event.date_start, Meet_location: event.venue || '', Meet_course: event.course || 'S' },
    teams, athletes, results
  }
  output.meta.sha256 = await sha256(output)
  return output
}

export { ATHLETE_FIELDS, RESULT_FIELDS }

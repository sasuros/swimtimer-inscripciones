import { categoryForAge, calculateAge } from './ageCalculator'
import { validateTime } from './timeParser'

export function validateAthlete(form, roster, referenceDate, editingId = null, categories) {
  const errors = {}
  if (!form.lastName.trim()) errors.lastName = 'Falta escribir el apellido del nadador'
  if (!form.firstName.trim()) errors.firstName = 'Falta escribir el nombre del nadador'
  if (!['F', 'M'].includes(form.sex)) errors.sex = 'Selecciona el sexo del nadador'
  if (!form.birthDate) errors.birthDate = 'Selecciona la fecha de nacimiento'
  const age = calculateAge(form.birthDate, referenceDate)
  if (form.birthDate && !categoryForAge(age, categories)) errors.birthDate = `La edad calculada (${age} años) no pertenece a las categorías del evento`
  const duplicate = roster.some(item => item.id !== editingId && `${item.firstName} ${item.lastName}`.toLocaleLowerCase() === `${form.firstName.trim()} ${form.lastName.trim()}`.toLocaleLowerCase())
  if (duplicate) errors.duplicate = 'Ya inscribiste a un nadador con este nombre y apellido'
  if (!form.selectedEvents.length) errors.events = 'Selecciona al menos un evento'
  form.selectedEvents.forEach(index => {
    const error = validateTime(form.times[index] || '')
    if (error) errors[`time-${index}`] = error
  })
  return errors
}

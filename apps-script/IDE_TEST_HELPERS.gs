// Вставьте в начало функции createValueAssessmentInvite (сразу после объявления):
//
//   if (data == null || typeof data !== 'object') {
//     return {
//       ok: false,
//       error: 'Нет данных запроса. Эту функцию вызывает только веб-приложение (POST JSON). ' +
//         'Из редактора не нажимайте «Выполнить» на createValueAssessmentInvite — запустите testCreateValueInvite().'
//     };
//   }
//
// Ниже — отдельная функция для проверки из IDE (Run → testCreateValueInvite).

/**
 * Тест отправки приглашения из редактора Apps Script (Run).
 * Подставьте свой email и при необходимости id вакансии из таблицы.
 */
function testCreateValueInvite() {
  const result = createValueAssessmentInvite({
    vacancy_id: 'test-from-ide',
    vacancy_name: 'Тестовая вакансия (IDE)',
    candidate_name: 'Тест Тестович',
    sent_date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    gender: 'male',
    email: 'vzksm.kotik@gmail.com',
    recruiter_id: 'ide-test',
    recruiter_name: 'Проверка из редактора',
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Если в UI ошибка: «Неизвестный action: createValueAssessmentInvite»
// — в задеплоенном веб-приложении в функции route() нет этих ключей.
//
// 1) Откройте ТОТ ЖЕ проект Apps Script, чей URL вы используете в config.js
// 2) В объекте handlers внутри route() добавьте строки ниже (рядом с addAssessment и т.д.)
// 3) Убедитесь, что в файле есть сами функции createValueAssessmentInvite, ...
// 4) Сохраните → Deploy → Manage deployments → Edit → New version → Deploy
//    (только «Сохранить» без нового деплоя часто НЕ обновляет /exec)
// ═══════════════════════════════════════════════════════════════════

// Вставить в объект handlers:
/*
      createValueAssessmentInvite: () => createValueAssessmentInvite(data),
      getValueAssessments:         () => getValueAssessments(data),
      getValueAssessmentResult:    () => getValueAssessmentResult(data),
      deleteValueAssessment:       () => deleteValueAssessment(data),
      startValueSurvey:            () => startValueSurvey(data),
      submitValueSurvey:           () => submitValueSurvey(data),
*/

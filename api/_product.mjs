/* Какой продукт спрашивает - по адресу, одним ответом для сервера и для страницы.
 *
 * ЗАЧЕМ (docs/SEPARATION-PLAN.md, шаг 0). Продукты расходятся по двум аккаунтам на одном деплое, и адрес -
 * единственное, что отличает запрос одного от запроса другого: одна сборка страницы, одни функции, один
 * проект Vercel. Сервер до сих пор не знал, кто спрашивает, кроме MCP с его `?profile=`; страница решала
 * сама - по пути, по localStorage или по замку сборки. Две редакции ответа на «какой это продукт»
 * разошлись бы в первый же день, когда появится второй адрес.
 *
 * СЕЙЧАС КАРТА ПУСТА - И ЭТО НАРОЧНО. Адреса P2 ещё нет (владелец: «адрес позже»), а запереть сегодняшний
 * адрес на P1 значило бы отрезать от владельца Record и документы до того, как им появится своё место.
 * Пустая карта - это «ещё не разделено»: null, и каждый читатель ведёт себя как вчера. Второй адрес
 * добавляется сюда ВМЕСТЕ с первым, одной строкой каждый, и тогда разделение включается разом везде.
 *
 * Зависимостей нет, как у _case.mjs и _brain.mjs: его читает и сервер, и браузер. Типы - в _product.d.mts. */

/** host → продукт. Пусто, пока у P2 нет своего адреса (шаг 1 плана). */
export const PRODUCT_HOSTS = {};

const IDS = ['do', 'make'];

/** Продукт этого адреса, или null - адрес не закреплён ни за одним (сегодня так для всех). */
export function productOfHost(host, map = PRODUCT_HOSTS) {
  const bare = String(host || '').trim().toLowerCase().replace(/:\d+$/, '');
  const said = bare ? map[bare] : null;
  return IDS.includes(said) ? said : null;
}

/**
 * Продукт запроса. Адрес сильнее всего: когда он закреплён, он и есть граница аккаунта. Иначе - явный
 * `?profile=` у MCP (сужение, о котором попросили); иначе null.
 */
export function productOfRequest(req, map = PRODUCT_HOSTS) {
  const headers = (req && req.headers) || {};
  const host = headers['x-forwarded-host'] || headers.host || '';
  const byHost = productOfHost(String(host).split(',')[0], map);
  if (byHost) return byHost;
  const profile = req && req.query ? String(req.query.profile || '').toLowerCase() : '';
  return IDS.includes(profile) ? profile : null;
}
